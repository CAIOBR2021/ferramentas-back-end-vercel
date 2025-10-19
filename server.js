// backend/server.js
const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // <--- ADICIONE ESTA LINHA

// ...
const app = express();
const port = 3000; // O backend rodará na porta 3000

// --- Middlewares ---
app.use(cors()); // Permite requisições de outras origens (seu frontend)
app.use(express.json()); // Para parsear JSON
app.use(express.urlencoded({ extended: true })); // Para parsear formulários

// Serve os arquivos estáticos da pasta 'uploads'
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Configuração do Banco de Dados (SQLite) ---
const dbPath = path.resolve(__dirname, 'almoxarifado.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Conectado ao banco de dados almoxarifado.db');
});

// Cria a tabela se ela não existir
db.run(`CREATE TABLE IF NOT EXISTS solicitacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitante TEXT[cite: 11],
    setor_obra TEXT[cite: 13],
    data_solicitacao TEXT[cite: 15],
    finalidade TEXT[cite: 17],
    tipo_ferramenta TEXT[cite: 24],
    quantidade INTEGER[cite: 26],
    status_ferramenta TEXT[cite: 28],
    data_devolucao TEXT[cite: 35],
    observacoes TEXT[cite: 38],
    foto_path TEXT
)`);


// --- VERIFICA E CRIA A PASTA UPLOADS ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log('Pasta "uploads" criada com sucesso.');
}

// --- Configuração do Upload (Multer) ---
// Define onde os arquivos serão salvos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Salva na pasta 'uploads'
    },
    filename: (req, file, cb) => {
        // Cria um nome de arquivo único (timestamp + nome original)
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// --- Rota Principal (Endpoint) ---
app.post('/submit-form', upload.single('foto_avaria'), (req, res) => {
    // 'foto_avaria' DEVE ser o mesmo 'name' do input no HTML 

    try {
        const data = req.body;
        const filePath = req.file ? req.file.path : null; // Caminho do arquivo salvo

        // Log para depuração
        console.log('Dados recebidos:', data);
        console.log('Arquivo recebido:', filePath);

        // Insere os dados no banco de dados
        const sql = `INSERT INTO solicitacoes (
            solicitante, setor_obra, data_solicitacao, finalidade, 
            tipo_ferramenta, quantidade, status_ferramenta, 
            data_devolucao, observacoes, foto_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            data.solicitante,
            data.setor, // O 'name' no HTML é 'setor'
            data.data_solicitacao,
            data.finalidade,
            data.tipo_ferramenta,
            data.quantidade,
            data.status_ferramenta,
            data.data_devolucao,
            data.observacoes,
            filePath
        ];

        db.run(sql, params, function (err) {
            if (err) {
                console.error('Erro ao salvar no banco:', err.message);
                return res.status(500).json({ message: 'Erro ao salvar dados.' });
            }
            console.log(`Nova solicitação salva com ID: ${this.lastID}`);
            res.status(201).json({
                message: 'Solicitação salva com sucesso!',
                id: this.lastID
            });
        });

    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// --- Iniciar o Servidor ---
app.listen(port, () => {
    console.log(`Backend rodando em http://localhost:${port}`);
});