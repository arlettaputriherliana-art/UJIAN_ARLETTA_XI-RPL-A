const API_URL = "http://localhost:5000/api";

// MEMUAT DAFTAR ALAT
async function muatDataAlat() {
    const container = document.getElementById("alat-container");
    const select = document.getElementById("alat-select");

    try {
        const response = await fetch(`${API_URL}/alat`);

        if (!response.ok) {
            throw new Error("Gagal mengambil data alat");
        }

        const alatList = await response.json();

        container.innerHTML = "";
        select.innerHTML = '<option value="">-- Pilih Alat --</option>';

        alatList.forEach(alat => {
            container.innerHTML += `
                <tr class="border-b">
                    <td class="p-3">${alat.id_alat}</td>
                    <td class="p-3">${alat.nama_alat}</td>
                    <td class="p-3">${alat.nama_kategori || "-"}</td>
                    <td class="p-3">${alat.kondisi}</td>
                    <td class="p-3">${alat.stok}</td>
                    <td class="p-3">${alat.lokasi || "-"}</td>
                </tr>
            `;

            select.innerHTML += `
                <option value="${alat.id_alat}" ${Number(alat.stok) < 1 ? "disabled" : ""}>
                    [Stok: ${alat.stok}] ${alat.nama_alat}
                </option>
            `;
        });

    } catch (error) {
        console.error(error);

        container.innerHTML = `
            <tr>
                <td colspan="6" class="p-4 text-red-500">
                    Gagal terhubung ke server.
                </td>
            </tr>
        `;
    }
}

// MEMUAT DAFTAR PEMINJAMAN DARI DATABASE
async function tampilkanPeminjaman() {
    const container = document.getElementById("peminjaman-container");

    try {
        const response = await fetch(`${API_URL}/peminjaman`);

        if (!response.ok) {
            throw new Error("Gagal mengambil data peminjaman");
        }

        const dataPeminjaman = await response.json();

        if (dataPeminjaman.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="9" class="p-4 text-center">
                        Belum ada data peminjaman.
                    </td>
                </tr>
            `;
            return;
        }

        container.innerHTML = dataPeminjaman.map(data => `
            <tr class="border-b">
                <td class="p-3">${data.id_peminjaman}</td>
                <td class="p-3">${data.nama_peminjam}</td>
                <td class="p-3">${data.kelas}</td>
                <td class="p-3">${data.nama_alat || "-"}</td>
                <td class="p-3">${data.jumlah}</td>
                <td class="p-3">${String(data.tanggal_pinjam).slice(0, 10)}</td>
                <td class="p-3">${String(data.tanggal_kembali).slice(0, 10)}</td>
                <td class="p-3">
                    <span class="${data.status === "Dipinjam" ? "text-orange-600" : "text-green-600"} font-semibold">
                        ${data.status}
                    </span>
                </td>
                <td class="p-3">
                    ${data.status === "Dipinjam" ? `
                        <button
                            onclick="kembalikanBarang(${data.id_peminjaman})"
                            class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg">
                            Kembalikan
                        </button>
                    ` : `
                        <span class="text-green-600 font-semibold">
                            Selesai
                        </span>
                    `}
                </td>
            </tr>
        `).join("");

    } catch (error) {
        console.error(error);

        container.innerHTML = `
            <tr>
                <td colspan="9" class="p-4 text-center text-red-500">
                    Gagal memuat data peminjaman.
                </td>
            </tr>
        `;
    }
}

// PROSES PENGEMBALIAN BARANG
async function kembalikanBarang(id) {
    const yakin = confirm(
        "Apakah kamu yakin barang ini sudah dikembalikan?"
    );

    if (!yakin) return;

    try {
        const response = await fetch(
            `${API_URL}/peminjaman/${id}/pengembalian`,
            {
                method: "PATCH"
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error);
        }

        alert(result.message);

        await tampilkanPeminjaman();
        await muatDataAlat();

    } catch (error) {
        alert(error.message);
    }
}

// FORM PEMINJAMAN
document.getElementById("form-peminjaman").addEventListener("submit", async e => {
    e.preventDefault();

    const alat = document.getElementById("alat-select");

    const data = {
        id_alat: Number(alat.value),
        nama_peminjam: document.getElementById("peminjam").value.trim(),
        kelas: document.getElementById("kelas").value.trim(),
        lokasi_peminjam: document.getElementById("lokasi-peminjam").value.trim(),
        lokasi_penyimpanan: document.getElementById("lokasi-penyimpanan").value.trim(),
        tanggal_pinjam: document.getElementById("tanggal-pinjam").value,
        tanggal_kembali: document.getElementById("tanggal-kembali").value,
        jumlah: Number(document.getElementById("jumlah").value)
    };

    const notif = document.getElementById("notifikasi");
    const tombol = e.target.querySelector('button[type="submit"]');

    if (data.tanggal_kembali < data.tanggal_pinjam) {
        notif.className = "mt-4 text-center text-red-600";
        notif.textContent = "Tanggal pengembalian tidak boleh sebelum tanggal pinjam.";
        return;
    }

    try {
        tombol.disabled = true;
        tombol.textContent = "Memproses...";

        const response = await fetch(`${API_URL}/peminjaman`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error);
        }

        notif.className = "mt-4 text-center text-green-600";
        notif.textContent = result.message;

        e.target.reset();

        document.getElementById("jumlah").value = 1;

        await tampilkanPeminjaman();
        await muatDataAlat();

    } catch (error) {
        notif.className = "mt-4 text-center text-red-600";
        notif.textContent = error.message;

    } finally {
        tombol.disabled = false;
        tombol.textContent = "Pinjam Alat";
    }
});

// MENAMPILKAN DATA SAAT HALAMAN DIBUKA
muatDataAlat();
tampilkanPeminjaman();