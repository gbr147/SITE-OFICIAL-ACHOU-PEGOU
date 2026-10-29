const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const PORT = 3000;

// Configuração de Armazenamento de Imagens
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// BANCO DE DADOS EM MEMÓRIA (INICIA LIMPO)
let usuarios = []; 
let posts = [];
let mensagens = [];

// Sessão Simulada no Servidor (Usuário Logado no momento)
let usuarioLogado = null; 

// Auxiliar para gerar slugs de URLs amigáveis
function gerarSlug(texto) {
    return texto.toString().toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

// ------------------- ROTAS DE AUTENTICAÇÃO -------------------

app.get('/login', (req, res) => {
    res.render('login', { msgErro: null, usuarioLogado });
});

app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    const user = usuarios.find(u => u.email === email && u.senha === senha);
    
    if (user) {
        usuarioLogado = user;
        res.redirect('/painel');
    } else {
        res.render('login', { msgErro: "E-mail ou senha incorretos.", usuarioLogado });
    }
});

app.post('/cadastro', (req, res) => {
    const { nome, email, senha } = req.body;
    if (usuarios.some(u => u.email === email)) {
        return res.render('login', { msgErro: "Este e-mail já está cadastrado.", usuarioLogado });
    }
    const novoUsuario = { nome, email, senha };
    usuarios.push(novoUsuario);
    usuarioLogado = novoUsuario;
    res.redirect('/painel');
});

app.get('/sair', (req, res) => {
    usuarioLogado = null;
    res.redirect('/');
});

app.post('/usuario/excluir', (req, res) => {
    if (!usuarioLogado) return res.redirect('/login');
    
    // Remove posts do usuário
    posts = posts.filter(p => p.autorEmail !== usuarioLogado.email);
    // Remove mensagens do usuário
    mensagens = mensagens.filter(m => m.de !== usuarioLogado.nome && m.para !== usuarioLogado.nome);
    // Remove o perfil
    usuarios = usuarios.filter(u => u.email !== usuarioLogado.email);
    
    usuarioLogado = null;
    res.redirect('/');
});


// ------------------- ROTAS DO FEED PRINCIPAL -------------------

app.get('/', (req, res) => {
    res.render('index', { posts, usuarioLogado });
});

app.post('/post/novo', upload.single('imagem'), (req, res) => {
    if (!usuarioLogado) return res.redirect('/login');
    
    const titulo = req.body.titulo;
    const novoPost = {
        id: posts.length + 1,
        titulo: titulo,
        descricao: req.body.descricao,
        imagem: req.file ? `/uploads/${req.file.filename}` : '',
        slug: gerarSlug(titulo),
        autorNome: usuarioLogado.nome,
        autorEmail: usuarioLogado.email,
        comentarios: []
    };
    posts.push(novoPost);
    res.redirect('/');
});

app.get('/item/:idUnique-:slug', (req, res) => {
    const post = posts.find(p => p.id == req.params.idUnique);
    if (!post) return res.status(404).send('Item não cadastrado.');
    res.render('post', { post, usuarioLogado });
});

app.post('/item/:id/comentario', (req, res) => {
    const post = posts.find(p => p.id == req.params.id);
    if (post) {
        post.comentarios.push({
            autor: usuarioLogado ? usuarioLogado.nome : (req.body.autor || "Anônimo"),
            texto: req.body.texto
        });
        res.redirect(`/item/${post.id}-${post.slug}`);
    } else {
        res.status(404).send('Erro.');
    }
});


// ------------------- TELA DE USUÁRIOS (PAINEL / MENSAGENS) -------------------

app.get('/painel', (req, res) => {
    if (!usuarioLogado) return res.redirect('/login');
    
    // Filtra dados pertencentes a este usuário específico
    const meusPosts = posts.filter(p => p.autorEmail === usuarioLogado.email);
    const minhasMensagens = mensagens.filter(m => m.para === usuarioLogado.nome || m.de === usuarioLogado.nome);
    
    res.render('painel', { usuarioLogado, meusPosts, minhasMensagens });
});

// Abertura de chat direto
app.get('/chat', (req, res) => {
    if (!usuarioLogado) return res.redirect('/login');
    const { para } = req.query;
    
    // Marca mensagens recebidas desse remetente como lidas ao entrar
    mensagens.forEach(m => {
        if(m.de === para && m.para === usuarioLogado.nome) {
            m.lida = true;
        }
    });

    const historico = mensagens.filter(m => 
        (m.de === usuarioLogado.nome && m.para === para) || 
        (m.de === para && m.para === usuarioLogado.nome)
    );
    
    res.render('chat', { de: usuarioLogado.nome, para, historico, usuarioLogado });
});

app.post('/chat/enviar', (req, res) => {
    if (!usuarioLogado) return res.sendStatus(403);
    const { para, texto } = req.body;
    
    mensagens.push({
        de: usuarioLogado.nome,
        para: para,
        texto: texto,
        lida: false, // Nova mensagem padrão
        data: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    
    res.redirect(`/chat?para=${para}`);
});

app.listen(PORT, () => console.log(`Achou? Pegou! online em http://localhost:${PORT}`));
