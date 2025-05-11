
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

    if (!videoUrl) return res.status(400).json({ error: "Provide a video URL!" });

    const outputPath = `downloads/%(title)s.%(ext)s`;
    const command = format === "mp4"
        ? `yt-dlp -f best ${videoUrl} -o "${outputPath}"`
        : `yt-dlp -f bestaudio --extract-audio --audio-format ${format} ${videoUrl} -o "${outputPath}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        res.json({ message: "Download started successfully!", output: stdout });
    });
});

// 🔍 Search YouTube (Fixes JSON parsing issue)
app.get("/search", (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Provide a search query!" });

    const command = `yt-dlp --default-search "ytsearch10" --dump-json "${query}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });

        try {
            const results = JSON.parse(`[${stdout.trim().split("\n").join(",")}]`);
            const formattedResults = results.map(video => ({
                title: video.title,
                url: video.webpage_url,
                duration: video.duration_string,
                thumbnail: video.thumbnail
            }));

            res.json(formattedResults);
        } catch (err) {
            console.error("JSON Parsing Error:", err);
            res.status(500).json({ error: "Failed to parse search results." });
        }
    });
});

// 📂 Cleanup Downloads Directory
app.get("/cleanup", (req, res) => {
    fs.readdir("downloads", (err, files) => {
        if (err) return res.status(500).json({ error: "Error accessing downloads folder." });

        files.forEach(file => fs.unlinkSync(`downloads/${file}`));
        res.json({ message: "Downloads folder cleaned successfully." });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});