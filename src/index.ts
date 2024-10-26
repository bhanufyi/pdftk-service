import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import fetch from "node-fetch";
import { exec as execCallback } from "child_process";
import bodyParser from "body-parser";
import express from "express";
import { promisify } from "node:util";

const urls = [
  // pdf urls go here
];

async function downloadUrl(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer(); // Correctly getting the buffer
    const outputPath = `/app/pdfs/${filename}`; // Use the mounted volume path
    await fs.writeFile(outputPath, Buffer.from(buffer)); // Correctly writing the buffer to a file
    console.log(`Downloaded ${url} to ${outputPath}`);
    return outputPath; // Return the full path
  } catch (error) {
    console.error(`Error downloading ${url}: ${error}`);
    return null;
  }
}

async function downloadAll(urls: string[]): Promise<(string | null)[]> {
  const downloadPromises = urls.map((url, index) => {
    return downloadUrl(url, getFilenameFromUrl(url));
  });

  return Promise.all(downloadPromises);
}

function getFilenameFromUrl(url: string) {
  const urlParts = url.split("/");
  return urlParts[urlParts.length - 1];
}

async function mergePdfs(urls: string[], outputFilename: string) {
  const pdfFiles = urls.map((url) => `/app/pdfs/${getFilenameFromUrl(url)}`); // Prepend the path to each filename
  const command = `pdftk ${pdfFiles.join(
    " "
  )} cat output /app/pdfs/${outputFilename}`;

  try {
    const exec = promisify(execCallback);
    const { stdout, stderr } = await exec(command);
    console.log(`PDFs merged into /app/pdfs/${outputFilename}`);
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return;
    }
    console.log(stdout);
  } catch (error) {
    console.error(`Error during PDF merge: ${error}`);
    throw error; // Rethrow or handle error as needed
  }
}

async function fetchUrlsById(id: string) {
  if (Number(id) === 1) {
    return urls;
  }
}

async function downloadAndMergePdfs(urls: string[]) {
  // Download PDFs and get local paths
  const pdfPaths = await downloadAll(urls);
  const filteredPdfPaths = pdfPaths.filter((path) => path !== null) as string[];

  // Merge PDFs
  const outputFilename = `merged_output_12.pdf`;
  await mergePdfs(filteredPdfPaths, outputFilename);

  return `/app/pdfs/${outputFilename}`;
}

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

app.get("/merge-pdfs/:id", async (req, res) => {
  const urls = await fetchUrlsById(req.params.id);

  if (!urls || urls.length === 0) {
    return res.status(400).send("No PDF URLs provided.");
  }

  try {
    // Download and merge PDFs
    const mergedPdfPath = await downloadAndMergePdfs(urls);

    // Stream the merged PDF back
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    createReadStream(mergedPdfPath)
      .pipe(res)
      .on("finish", () => {
        // Optionally, clean up the merged PDF file after sending it
        fs.unlink(mergedPdfPath);
      });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while merging PDFs.");
  }
});

//   (async () => {
//   const startTime = new Date(); // Start timing
//   const downloadedFiles = await downloadAll(urls);
//   console.log("All downloads completed");
//   console.log(downloadedFiles);
//   await mergePdfs(urls, "merged_output.pdf");
//   const endTime = new Date(); // End timing
//   const timeTaken = endTime - startTime; // Calculate the time taken in milliseconds

//   console.log(`Total execution time: ${timeTaken} ms`);
// })();

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
