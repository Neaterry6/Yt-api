const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// 🎵 Download Audio or Video
app.get("/download", (req, res) => {
    const videoUrl = req.query.url;
    const format = req.query.format || "mp3"; // Default to MP3

    if (!videoUrl) return res.status(400).send("Provide a video URL!");

    const outputPath = `downloads/%(title)s.%(ext)s`;
    const command = format === "mp4"
        ? `yt-dlp -f best ${videoUrl} -o "${outputPath}"`
        : `yt-dlp -f bestaudio --extract-audio --audio-format ${format} ${videoUrl} -o "${outputPath}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) return res.status(500).send(`Error: ${stderr}`);
        res.send(`Downloaded: ${stdout}`);
    });
});

// 🔍 Search YouTube
app.get("/search", (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("Provide a search query!");

    const command = `yt-dlp "ytsearch10:${query}" --dump-json`;

    exec(command, (error, stdout, stderr) => {
        if (error) return res.status(500).send(`Error: ${stderr}`);

        try {
            const results = stdout
                .split("\n")
                .filter(line => line.trim().length > 0)
                .map(line => JSON.parse(line))
                .map(video => ({
                    title: video.title,
                    url: video.webpage_url
                }));

            res.json(results);
        } catch (err) {
            res.status(500).send("Failed to parse search results.");
        }
    });
});

// 📂 Cleanup Downloads Directory
app.get("/cleanup", (req, res) => {
    fs.readdir("downloads", (err, files) => {
        if (err) return res.status(500).send("Error accessing downloads folder.");

        files.forEach(file => fs.unlinkSync(`downloads/${file}`));
        res.send("Downloads folder cleaned.");
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
