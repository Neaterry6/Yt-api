const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

app.get("/download", (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send("Provide a video URL!");

    const command = `yt-dlp -f bestaudio --extract-audio --audio-format mp3 ${videoUrl} -o "downloads/%(title)s.%(ext)s"`;

    exec(command, (error, stdout, stderr) => {
        if (error) return res.status(500).send(`Error: ${stderr}`);
        res.send(`Downloaded: ${stdout}`);
    });
});

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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
