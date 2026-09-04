const zone = process.env.BUNNY_STORAGE_ZONE;
const endpoint = process.env.BUNNY_STORAGE_ENDPOINT;
const accessKey = process.env.BUNNY_STORAGE_ACCESS_KEY;
const cdnUrl = (process.env.BUNNY_CDN_URL || "").replace(/\/$/, "");

if (!zone || !endpoint || !accessKey || !cdnUrl) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const fileName = `bunny-test-${Date.now()}.txt`;
const remotePath = `test/${fileName}`;

const content = `Bunny Storage test successful!
Created: ${new Date().toISOString()}
`;

async function main() {
  const url = `https://${endpoint}/${zone}/${remotePath}`;

  console.log("Uploading...");
  console.log("Path:", remotePath);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: accessKey,
      "Content-Type": "text/plain",
    },
    body: content,
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`❌ Upload failed: HTTP ${response.status}`);
    console.error(body);
    process.exit(1);
  }

  const publicUrl = `${cdnUrl}/${remotePath}`;

  console.log("\n✅ UPLOAD SUCCESSFUL!");
  console.log("Public URL:");
  console.log(publicUrl);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});