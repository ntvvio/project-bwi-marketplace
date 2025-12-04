require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken'); 

const app = express();
const PORT = process.env.PORT || 3300;
const JWT_SECRET = process.env.JWT_SECRET; 

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client:', err);
});

const protect = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) {
        return res.status(401).json({ error: 'Akses ditolak. Token tidak ditemukan.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token tidak valid atau kadaluwarsa.' });
        }
        req.user = user; 
        next();
    });
};

app.post('/register', async (req, res, next) => {
    const { username, password, role } = req.body;
    try {
        const sql = `
            INSERT INTO users (username, password, role)
            VALUES ($1, $2, $3)
            RETURNING id, username, role;
        `;
        const result = await pool.query(sql, [username, password, role || 'user']);
        res.status(201).json({ message: 'User berhasil didaftarkan.', user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') { 
            return res.status(400).json({ error: 'Username sudah digunakan.' });
        }
        next(err);
    }
});

app.post('/login', async (req, res, next) => {
    const { username, password } = req.body;
    try {
        const sql = "SELECT id, username, password, role FROM users WHERE username = $1";
        const result = await pool.query(sql, [username]);

        if (result.rows.length === 0 || result.rows[0].password !== password) {
            return res.status(401).json({ error: 'Username atau password salah.' });
        }

        const user = result.rows[0];
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' } 
        );

        res.json({ 
            message: 'Login berhasil', 
            token: token,
            user: { username: user.username, role: user.role }
        });

    } catch (err) {
        next(err);
    }
});

//vendorA
//get
app.get('/vendorA', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM vendor_a ORDER BY kd_produk ASC');
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

//vendorB
//get
app.get('/vendorB', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM vendor_b ORDER BY sku ASC');
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

//vendorC
//get
app.get('/vendorC', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM vendor_c ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

//create
app.post('/vendorC', async (req, res, next) => {
    try {
        const { id, details, pricing, stock } = req.body;
        
        if (!id || !details || !pricing || stock === undefined) {
            return res.status(400).json({ error: 'Data tidak lengkap' });
        }

        const sql = 'INSERT INTO vendor_c (id, details, pricing, stock) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(sql, [id, JSON.stringify(details), JSON.stringify(pricing), stock]);
        
        res.status(201).json({ message: 'Produk berhasil ditambahkan', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

//put
app.put('/vendorC/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { details, pricing, stock } = req.body;
        
        const setClauses = [];
        const values = [];
        let index = 1;

        if (details !== undefined) {
            setClauses.push(`details = $${index++}`);
            values.push(JSON.stringify(details));
        }
        if (pricing !== undefined) {
            setClauses.push(`pricing = $${index++}`);
            values.push(JSON.stringify(pricing));
        }
        if (stock !== undefined) {
            setClauses.push(`stock = $${index++}`);
            values.push(stock);
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data untuk diupdate' });
        }

        values.push(id);
        const sql = `UPDATE vendor_c SET ${setClauses.join(', ')} WHERE id = $${index} RETURNING *`;
        const result = await pool.query(sql, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        res.json({ message: 'Produk berhasil diupdate', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

//delete
app.delete('/vendorC/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query('DELETE FROM vendor_c WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        res.json({ message: 'Produk berhasil dihapus', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

app.get('/products/normalize', protect, async (req, res, next) => {
    if (req.user.role !== 'admin') {
         return res.status(403).json({ error: 'Akses Ditolak. Hanya Admin yang diizinkan menjalankan proses Integrasi.' });
    }

    try {
        await pool.query('SELECT 1');
        res.json({ 
            message: 'Server, Koneksi DB, dan Otorisasi (Admin) BERHASIL. Siap menerima Logika Integrasi Vendor.',
            status_koneksi_db: 'OK',
            user_verified: req.user.username
        });

    } catch (err) {
        console.error('[KONEKSI DB ERROR]', err.stack);
        res.status(500).json({ error: 'Gagal menguji koneksi database.' });
    }
});

app.get('/products', async (req, res, next) => {
    try {
        const sql = "SELECT * FROM products ORDER BY id ASC";
        const result = await pool.query(sql);
        res.json({
            message: "Menampilkan data normalisasi (Saat ini mungkin kosong/dummy).",
            data: result.rows
        });
    } catch (err) {
        next(err);
    }
});

app.use('/status', (req, res) => {
    res.json({ ok: true, service: 'Banyuwangi Integrator API (Basic Foundation)' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Rute tidak ditemukan' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server aktif di http://localhost:${PORT}`);
});

module.exports = app;