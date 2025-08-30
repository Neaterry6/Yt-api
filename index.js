const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis"); // Add googleapis for YouTube API

const app = express();
const port = process.env.PORT || 3000;

// Set yt-dlp binary path and cookies
const ytDlpPath = path.resolve(__dirname, "yt-dlp");
const cookiesPath = path.resolve(__dirname, "cookies.txt");
const downloadsDir = path.resolve(__dirname, "downloads");

// Ensure downloads directory exists
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

app.use(cors());
app.use(express.json());

// Serve static files from downloads directory
app.use("/downloads", express.static(downloadsDir));

// ✅ Health Check Endpoint
app.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "API is working!",
        data: null
    });
});

// 🎵 Download Audio or Video
app.get("/download", (req, res) => {
    const videoUrl = req.query.url;
    const format = req.query.format || "mp3"; // Default to MP3

    if (!videoUrl) {
        return res.status(400).json({
            status: "error",
            message: "Provide a video URL!",
            data: null
        });
    }

    const outputFile = `%(title)s.%(ext)s`;
    const outputPath = path.join(downloadsDir, outputFile);
    const sanitizedOutputFile = "%(title)s.%(ext)s".replace(/[^a-zA-Z0-9%()._-]/g, "_");
    const sanitizedOutputPath = path.join(downloadsDir, sanitizedOutputFile);

    const command = format === "mp4"
        ? `"${ytDlpPath}" --cookies "${cookiesPath}" -f best "${videoUrl}" -o "${sanitizedOutputPath}" --merge-output-format mp4`
        : `"${ytDlpPath}" --cookies "${cookiesPath}" -f bestaudio --extract-audio --audio-format ${format} "${videoUrl}" -o "${sanitizedOutputPath}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({
                status: "error",
                message: "Download failed",
                data: { error: stderr }
            });
        }

        // Get the actual filename after download
        const files = fs.readdirSync(downloadsDir);
        const downloadedFile = files.find(file => file.includes(path.parse(sanitizedOutputFile).name));

        if (!downloadedFile) {
            return res.status(500).json({
                status: "error",
                message: "Could not find downloaded file",
                data: null
            });
        }

        const downloadUrl = `/downloads/${encodeURIComponent(downloadedFile)}`;

        res.json({
            status: "success",
            message: "Download completed",
            data: {
                downloadUrl: downloadUrl,
                filename: downloadedFile,
                stdout: stdout
            }
        });
    });
});

// 📥 Serve Downloaded File
app.get("/file/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(downloadsDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            status: "error",
            message: "File not found",
            data: null
        });
    }

    res.download(filePath, filename, (err) => {
        if (err) {
            return res.status(500).json({
                status: "error",
                message: "Error serving file",
                data: { error: err.message }
            });
        }
    });
});

// 🔍 Improved Search with YouTube Data API
app.get("/search", async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({
            status: "error",
            message: "Provide a search query!",
            data: null
        });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;

    if (apiKey) {
        // Use YouTube Data API if API key is available
        try {
            const youtube = google.youtube({
                version: "v3",
                auth: apiKey,
            });

            const response = await youtube.search.list({
                part: "snippet",
                q: query,
                maxResults: 5, // Limit to 5 results, adjustable up to 50
                type: "video",
            });

            const formattedResults = response.data.items.map(video => ({
                title: video.snippet.title,
                url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
                duration: null, // YouTube API doesn't provide duration in search; fetch separately if needed
                thumbnail: video.snippet.thumbnails.default.url,
            }));

            return res.json({
                status: "success",
                message: "Search completed",
                data: formattedResults,
                source: "YouTube Data API"
            });
        } catch (error) {
            console.error("YouTube API Error:", error);
            // Fallback to yt-dlp if API fails
            console.log("Falling back to yt-dlp search due to API error");
        }
    }

    // Fallback to yt-dlp search if no API key or API fails
    const command = `"${ytDlpPath}" --cookies "${cookiesPath}" --default-search "ytsearch5" --dump-json "${query}"`;

    setTimeout(() => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                return res.status(500).json({
                    status: "error",
                    message: "Search failed",
                    data: { error: stderr }
                });
            }

            try {
                const results = JSON.parse(`[${stdout.trim().split("\n").join(",")}]`);
                const formattedResults = results.map(video => ({
                    title: video.title,
                    url: video.webpage_url,
                    duration: video.duration_string,
                    thumbnail: video.thumbnail
                }));

                res.json({
                    status: "success",
                    message: "Search completed",
                    data: formattedResults,
                    source: "yt-dlp"
                });
            } catch (err) {
                console.error("JSON Parsing Error:", err);
                res.status(500).json({
                    status: "error",
                    message: "Failed to parse search results",
                    data: { error: err.message }
                });
            }
        });
    }, Math.random() * 3000);
});

// 📂 Cleanup Downloads Directory
app.get("/cleanup", (req, res) => {
    try {
        const files = fs.readdirSync(downloadsDir);
        files.forEach(file => fs.unlinkSync(path.join(downloadsDir, file)));

        res.json({
            status: "success",
            message: "Downloads folder cleaned successfully",
            data: { deletedFiles: files }
        });
    } catch (err) {
        res.status(500).json({
            status: "error",
            message: "Error accessing downloads folder",
            data: { error: err.message }
        });
    }
});

module.exports = app;