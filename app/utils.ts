// ✅ **Polling function for images & PDFs**
export const fetchFileUrl = async (
  admin: any,
  fileId: string,
  retries = 5,
  delay = 2000,
) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    const fileURLQuery = `query {
      node(id: "${fileId}") {
        id
        ... on MediaImage {
          image { url }
        }
        ... on GenericFile {
          url
        }
      }
    }`;

    const fileUrlResponse = await admin.graphql(fileURLQuery);
    const fileUrlResponseData = await fileUrlResponse.json();

    // Extract correct URL depending on type
    const imageUrl = fileUrlResponseData?.data?.node?.image?.url;
    const fileUrl = fileUrlResponseData?.data?.node?.url;

    if (imageUrl || fileUrl) {
      return imageUrl || fileUrl; // ✅ URL is ready, return it
    }

    console.log(`⏳ Waiting for public URL... (${attempt + 1}/${retries})`);
    await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retrying
  }

  throw new Error("File registered, but public URL not available.");
};
