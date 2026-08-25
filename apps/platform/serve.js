http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  urlPath = urlPath === "/" ? "/index.html" : urlPath;
  if (urlPath.endsWith("/")) urlPath += "index.html";

  const filePath = path.normalize(path.join(ROOT, urlPath));

  // Ensure the resolved path is still inside ROOT
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
    } else {
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    }
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Static server on http://0.0.0.0:${PORT}`);
});