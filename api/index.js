// api/index.js
const express = require('express');
const multer = require('multer');
const { Pool } = require('pg'); // <-- MUDANÇA: Sai sqlite3, entra pg (Postgres)
const { put } = require('@vercel/blob'); // <-- MUDANÇA: Para uploads
const cors = require('cors');
// const fs = require('fs'); // <-- REMOVIDO: Não podemos mais escrever arquivos

const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- REMOVIDO ---
// app.use('/uploads', ...);
// A pasta 'uploads' não existe mais.

// --- Configuração do Banco de Dados (Vercel Postgres) ---
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL, // Vercel injeta esta variável
  ssl: {
    rejectUnauthorized: false,
  },
});

// Cria a tabela se ela não existir (Sintaxe do Postgres é um pouco diferente)
const createTableQuery = `
CREATE TABLE IF NOT EXISTS solicitacoes (
    id SERIAL PRIMARY KEY, 
    solicitante TEXT,
    setor_obra TEXT,
    data_solicitacao TEXT,
    finalidade TEXT,
    tipo_ferramenta TEXT,
    quantidade INTEGER,
    status_ferramenta TEXT,
    data_devolucao TEXT,
    observacoes TEXT,
    foto_path TEXT
)`;

// Verifica/Cria a tabela ao iniciar
pool.query(createTableQuery, (err, res) => {
  if (err) {
    console.error('Erro ao criar tabela:', err);
  } else {
    console.log('Tabela "solicitacoes" verificada/criada.');
  }
});

// --- Configuração do Upload (Multer em Memória) ---
// MUDANÇA: Não vamos salvar em disco, vamos guardar na memória.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Rota Principal (Endpoint) ---
// MUDANÇA: A rota agora é 'async' para esperar o upload para a nuvem
app.post('/submit-form', upload.single('foto_avaria'), async (req, res) => {
  try {
    const data = req.body;
    let fotoUrl = null; // Vamos salvar a URL da nuvem, não o caminho do arquivo

    // 1. Se um arquivo foi enviado, faz o upload para o Vercel Blob
    if (req.file) {
      const { originalname, buffer } = req.file;

      // Gera um nome de arquivo único
      const filename = `${Date.now()}-${originalname}`;

      // Faz o upload para o Vercel Blob
      const blob = await put(filename, buffer, {
        access: 'public', // Torna o arquivo publicamente acessível
      });

      fotoUrl = blob.url; // Esta é a URL pública da imagem
    }

    console.log('Dados recebidos:', data);
    console.log('URL da foto:', fotoUrl);

    // 2. Inserir os dados no Vercel Postgres
    // MUDANÇA: Sintaxe SQL (de ? para $1, $2, ...)
    const sql = `INSERT INTO solicitacoes (
            solicitante, setor_obra, data_solicitacao, finalidade, 
            tipo_ferramenta, quantidade, status_ferramenta, 
            data_devolucao, observacoes, foto_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`; // Pede ao Postgres para retornar o ID criado

    const params = [
      data.solicitante,
      data.setor,
      data.data_solicitacao,
      data.finalidade,
      data.tipo_ferramenta,
      data.quantidade,
      data.status_ferramenta,
      data.data_devolucao,
      data.observacoes,
      fotoUrl, // Salva a URL da nuvem
    ];

    // MUDANÇA: Usando pool.query (assíncrono)
    const result = await pool.query(sql, params);

    const newId = result.rows[0].id;
    console.log(`Nova solicitação salva com ID: ${newId}`);
    res.status(201).json({
      message: 'Solicitação salva com sucesso!',
      id: newId,
    });
  } catch (error) {
    console.error('Erro no servidor:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// --- Iniciar o Servidor (MUDANÇA FINAL) ---
// REMOVA o app.listen. A Vercel cuida disso.
// app.listen(port, () => { ... });

// Apenas exporte o 'app'
module.exports = app;
