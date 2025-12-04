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
        const result = await pool.query('SELECT * FROM raw_products_a ORDER BY kd_produk ASC');
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// buat data baru
app.post('/vendorA', async (req, res, next) => {
    try {
        const { kd_produk, nm_brg, hrg, ket_stok } = req.body;
        
        if (!kd_produk || !nm_brg || !hrg || !ket_stok) {
            return res.status(400).json({ error: 'Data tidak lengkap' });
        }

        const sql = 'INSERT INTO raw_products_a (kd_produk, nm_brg, hrg, ket_stok) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(sql, [kd_produk, nm_brg, hrg, ket_stok]);
        
        res.status(201).json({ message: 'Produk berhasil ditambahkan', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

// edit data
app.put('/vendorA/:kd_produk', async (req, res, next) => {
    try {
        const { kd_produk } = req.params;
        const { nm_brg, hrg, ket_stok } = req.body;
        
        const setClauses = [];
        const values = [];
        let index = 1;

        if (nm_brg !== undefined) {
            setClauses.push(`nm_brg = $${index++}`);
            values.push(nm_brg);
        }
        if (hrg !== undefined) {
            setClauses.push(`hrg = $${index++}`);
            values.push(hrg);
        }
        if (ket_stok !== undefined) {
            setClauses.push(`ket_stok = $${index++}`);
            values.push(ket_stok);
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data untuk diupdate' });
        }

        values.push(kd_produk);
        const sql = `UPDATE raw_products_a SET ${setClauses.join(', ')} WHERE kd_produk = $${index} RETURNING *`;
        const result = await pool.query(sql, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        res.json({ message: 'Produk berhasil diupdate', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

// hapus data
app.delete('/vendorA/:kd_produk', async (req, res, next) => {
    try {
        const { kd_produk } = req.params;
        
        const result = await pool.query('DELETE FROM raw_products_a WHERE kd_produk = $1 RETURNING *', [kd_produk]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        res.json({ message: 'Produk berhasil dihapus', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

// MENAMPILKAN VENDOR B
app.get('/vendorB', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM raw_products_b ORDER BY sku ASC');
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// MEMBUAT VENDOR B
app.post('/vendorB', async (req, res, next) => {
    try {
        const { sku, productName, price, isAvailable } = req.body;
        
        if (!sku || !productName || price === undefined || isAvailable === undefined) {
            return res.status(400).json({ error: 'Data tidak lengkap' });
        }

        const sql = 'INSERT INTO raw_products_b (sku, productName, price, isAvailable) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(sql, [sku, productName, price, isAvailable]);
        
        res.status(201).json({ message: 'Produk berhasil ditambahkan', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

// UPDATE VENDOR B
app.put('/vendorB/:sku', async (req, res, next) => {
    try {
        const { sku } = req.params;
        const { productName, price, isAvailable } = req.body;
        
        const setClauses = [];
        const values = [];
        let index = 1;

        if (productName !== undefined) {
            setClauses.push(`productName = $${index++}`);
            values.push(productName);
        }
        if (price !== undefined) {
            setClauses.push(`price = $${index++}`);
            values.push(price);
        }
        if (isAvailable !== undefined) {
            setClauses.push(`isAvailable = $${index++}`);
            values.push(isAvailable);
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data untuk diupdate' });
        }

        values.push(sku);
        const sql = `UPDATE raw_products_b SET ${setClauses.join(', ')} WHERE sku = $${index} RETURNING *`;
        const result = await pool.query(sql, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        res.json({ message: 'Produk berhasil diupdate', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

// HAPUS VENDOR B
app.delete('/vendorB/:sku', async (req, res, next) => {
    try {
        const { sku } = req.params;
        
        const result = await pool.query('DELETE FROM raw_products_b WHERE sku = $1 RETURNING *', [sku]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        res.json({ message: 'Produk berhasil dihapus', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

//vendor C
//get - read
app.get('/vendorC', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM raw_products_c ORDER BY vendor_id ASC');
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

//post - create
app.post('/vendorC', async (req, res, next) => {
    try {
        const { vendor_id, details, pricing, stock } = req.body;
        
        if (!vendor_id || !details || !pricing || stock === undefined) {
            return res.status(400).json({ error: 'Data tidak lengkap' });
        }

        const sql = `INSERT INTO raw_products_c 
            (vendor_id, details_name, details_category, pricing_base_price, pricing_tax, stock) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
        
        const result = await pool.query(sql, [
            vendor_id, 
            details.name, 
            details.category, 
            pricing.base_price, 
            pricing.tax, 
            stock
        ]);
        
        res.status(201).json({ message: 'Produk berhasil ditambahkan', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

//put - update
app.put('/vendorC/:vendor_id', async (req, res, next) => {
    try {
        const { vendor_id } = req.params;
        const { details, pricing, stock } = req.body;
        
        const setClauses = [];
        const values = [];
        let index = 1;

        if (details) {
            if (details.name !== undefined) {
                setClauses.push(`details_name = $${index++}`);
                values.push(details.name);
            }
            if (details.category !== undefined) {
                setClauses.push(`details_category = $${index++}`);
                values.push(details.category);
            }
        }
        
        if (pricing) {
            if (pricing.base_price !== undefined) {
                setClauses.push(`pricing_base_price = $${index++}`);
                values.push(pricing.base_price);
            }
            if (pricing.tax !== undefined) {
                setClauses.push(`pricing_tax = $${index++}`);
                values.push(pricing.tax);
            }
        }
        
        if (stock !== undefined) {
            setClauses.push(`stock = $${index++}`);
            values.push(stock);
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data untuk diupdate' });
        }

        values.push(vendor_id);
        const sql = `UPDATE raw_products_c SET ${setClauses.join(', ')} WHERE vendor_id = $${index} RETURNING *`;
        const result = await pool.query(sql, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        res.json({ message: 'Produk berhasil diupdate', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

//delete - remove
app.delete('/vendorC/:vendor_id', async (req, res, next) => {
    try {
        const { vendor_id } = req.params;
        
        const result = await pool.query('DELETE FROM raw_products_c WHERE vendor_id = $1 RETURNING *', [vendor_id]);
        
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