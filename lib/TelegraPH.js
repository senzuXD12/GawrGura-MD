//udah gw ganti jadi pomf2.lain.la udah ga make telegraph

const axios = require("axios");
const BodyForm = require("form-data");
const fs = require("fs");

const PomfUpload = async (Path) => 
	new Promise(async (resolve, reject) => {
		if (!fs.existsSync(Path)) return reject(new Error("File tidak ditemukan!"));
		try {
			const form = new BodyForm();
			form.append("file", fs.createReadStream(Path));
			const { data } = await axios({
				url: "https://pomf2.lain.la/upload.php",
				method: "POST",
				headers: {
					...form.getHeaders(),
				},
				data: form,
			});

			// Cek respons untuk memastikan berhasil
			if (data.success && data.files && data.files.length > 0) {
				return resolve("https://pomf2.lain.la/" + data.files[0].url);
			} else {
				return reject(new Error("Gagal mengunggah file ke pomf2.lain.la!"));
			}
		} catch (err) {
			return reject(new Error(String(err)));
		}
	});

module.exports = { PomfUpload };