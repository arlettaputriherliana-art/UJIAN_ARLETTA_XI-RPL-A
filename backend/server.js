const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "db_peminjaman_alat",
    password: "9109",
    port: 5432,
});

// HALAMAN UTAMA BACKEND
app.get("/", (req, res) => {
    res.json({
        pesan: "Server Sistem Informasi Peminjaman Alat Praktik Berhasil Berjalan!"
    });
});

// MENAMPILKAN DAFTAR ALAT
app.get("/api/alat", async (req, res) => {
    try {
        const query = `
            SELECT
                a.id_alat,
                a.nama_alat,
                a.stok,
                a.kondisi,
                a.lokasi,
                k.nama_kategori
            FROM alat a
            LEFT JOIN kategori_alat k
                ON a.id_kategori = k.id_kategori
            ORDER BY a.id_alat ASC;
        `;

        const result = await pool.query(query);
        res.json(result.rows);

    } catch (err) {
        console.error(err.message);

        res.status(500).json({
            error: "Gagal mengambil data alat"
        });
    }
});

// MENAMPILKAN RIWAYAT PEMINJAMAN
app.get("/api/peminjaman", async (req, res) => {
    try {
        const query = `
            SELECT
                p.*,
                a.nama_alat
            FROM peminjaman p
            LEFT JOIN alat a
                ON p.id_alat = a.id_alat
            ORDER BY p.id_peminjaman DESC;
        `;

        const result = await pool.query(query);
        res.json(result.rows);

    } catch (err) {
        console.error(err.message);

        res.status(500).json({
            error: "Gagal mengambil data peminjaman"
        });
    }
});

// MENAMBAHKAN PEMINJAMAN
app.post("/api/peminjaman", async (req, res) => {
    const {
        id_alat,
        nama_peminjam,
        kelas,
        lokasi_peminjam,
        lokasi_penyimpanan,
        tanggal_pinjam,
        tanggal_kembali,
        jumlah
    } = req.body;

    if (
        !Number.isInteger(Number(id_alat)) ||
        !nama_peminjam ||
        !kelas ||
        !lokasi_peminjam ||
        !lokasi_penyimpanan ||
        !tanggal_pinjam ||
        !tanggal_kembali ||
        !Number.isInteger(Number(jumlah)) ||
        Number(jumlah) < 1
    ) {
        return res.status(400).json({
            error: "Data peminjaman belum lengkap atau tidak valid"
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // MEMERIKSA STOK ALAT
        const alat = await client.query(
            `SELECT * FROM alat
             WHERE id_alat = $1
             FOR UPDATE`,
            [id_alat]
        );

        if (alat.rows.length === 0) {
            throw new Error("Alat tidak ditemukan");
        }

        if (alat.rows[0].stok < Number(jumlah)) {
            throw new Error("Stok alat tidak mencukupi");
        }

        // MENGURANGI STOK
        await client.query(
            `UPDATE alat
             SET stok = stok - $1
             WHERE id_alat = $2`,
            [jumlah, id_alat]
        );

        // MENYIMPAN DATA PEMINJAMAN
        const query = `
            INSERT INTO peminjaman (
                id_alat,
                nama_peminjam,
                kelas,
                lokasi_peminjam,
                lokasi_penyimpanan,
                tanggal_pinjam,
                tanggal_kembali,
                jumlah,
                status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *;
        `;

        const values = [
            id_alat,
            nama_peminjam,
            kelas,
            lokasi_peminjam,
            lokasi_penyimpanan,
            tanggal_pinjam,
            tanggal_kembali,
            jumlah,
            "Dipinjam"
        ];

        const result = await client.query(query, values);

        await client.query("COMMIT");

        res.status(201).json({
            message: "Peminjaman berhasil dicatat!",
            data: result.rows[0]
        });

    } catch (err) {
        await client.query("ROLLBACK");

        console.error("Error peminjaman:", err.message);

        res.status(400).json({
            error: err.message
        });

    } finally {
        client.release();
    }
});

// PROSES PENGEMBALIAN BARANG
app.patch("/api/peminjaman/:id/pengembalian", async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const id = req.params.id;

        // MENCARI DATA PEMINJAMAN
        const peminjaman = await client.query(
            `SELECT *
             FROM peminjaman
             WHERE id_peminjaman = $1
             FOR UPDATE`,
            [id]
        );

        if (peminjaman.rows.length === 0) {
            throw new Error("Data peminjaman tidak ditemukan");
        }

        const data = peminjaman.rows[0];

        if (data.status !== "Dipinjam") {
            throw new Error("Barang sudah dikembalikan");
        }

        // MENAMBAHKAN STOK KEMBALI
        const updateStok = await client.query(
            `UPDATE alat
             SET stok = stok + $1
             WHERE id_alat = $2`,
            [data.jumlah, data.id_alat]
        );

        if (updateStok.rowCount === 0) {
            throw new Error("Data alat tidak ditemukan");
        }

        // MENGUBAH STATUS PEMINJAMAN
        await client.query(
            `UPDATE peminjaman
             SET status = 'Dikembalikan'
             WHERE id_peminjaman = $1`,
            [id]
        );

        await client.query("COMMIT");

        res.json({
            message: "Barang berhasil dikembalikan!"
        });

    } catch (err) {
        await client.query("ROLLBACK");

        console.error("Error pengembalian:", err.message);

        res.status(400).json({
            error: err.message
        });

    } finally {
        client.release();
    }
});

// MENJALANKAN SERVER
const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server backend berjalan di http://localhost:${PORT}`);
});