const express = require('express');
const https = require('https');

const app = express();
app.use(express.json());

// Configurações da API REST do Supabase
const SUPABASE_HOST = "rpanwkvzsuhixnskidla.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwYW53a3ZzenVoaXhuc2tpZGxhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTI4MDAwMCwiZXhwIjoyMDU0ODU2MDAwfQ=="; // Service Role Key para ignorar RLS

// 1. Rota para gerar e salvar chaves (Painel ADM)
app.get('/api/save', (req, res) => {
  const { key, duration } = req.query;
  if (!key) return res.status(400).send('Erro: Chave em falta.');

  const dias = duration ? parseInt(duration) : 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + dias);

  const postData = JSON.stringify({
    key_name: key,
    duration_days: dias,
    expires_at: expiresAt.toISOString()
  });

  const options = {
    hostname: SUPABASE_HOST,
    path: '/rest/v1/licenses',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer': 'return=representation'
    }
  };

  const supabaseReq = https.request(options, (supabaseRes) => {
    let data = '';
    supabaseRes.on('data', (chunk) => { data += chunk; });
    supabaseRes.on('end', () => {
      if (supabaseRes.statusCode >= 200 && supabaseRes.statusCode < 300) {
        res.status(200).send('SUCESSO: Chave criada e salva no Supabase!');
      } else {
        res.status(500).send('Erro Supabase (' + supabaseRes.statusCode + '): ' + data);
      }
    });
  });

  supabaseReq.on('error', (err) => {
    res.status(500).send('Erro de rede: ' + err.message);
  });

  supabaseReq.write(postData);
  supabaseReq.end();
});

// 2. Rota para verificar chaves (Painel do Cliente)
app.get('/api/verify', (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).send('Erro: Chave em falta.');

  const options = {
    hostname: SUPABASE_HOST,
    path: `/rest/v1/licenses?key_name=eq.${encodeURIComponent(key)}`,
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }
  };

  const supabaseReq = https.request(options, (supabaseRes) => {
    let data = '';
    supabaseRes.on('data', (chunk) => { data += chunk; });
    supabaseRes.on('end', () => {
      try {
        if (supabaseRes.statusCode >= 200 && supabaseRes.statusCode < 300) {
          const rows = JSON.parse(data);
          if (!rows || rows.length === 0) {
            return res.status(404).send('Chave inválida ou não encontrada.');
          }

          const license = rows[0];
          const now = new Date();
          const expiresAt = new Date(license.expires_at);

          if (now > expiresAt) {
            return res.status(400).send('Chave expirada.');
          }

          res.status(200).send('SUCESSO: Acesso liberado!');
        } else {
          res.status(500).send('Erro Supabase: ' + data);
        }
      } catch (e) {
        res.status(500).send('Erro ao processar resposta.');
      }
    });
  });

  supabaseReq.on('error', (err) => {
    res.status(500).send('Erro de rede: ' + err.message);
  });

  supabaseReq.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API HTTPS a correr na porta ${PORT}`);
});
