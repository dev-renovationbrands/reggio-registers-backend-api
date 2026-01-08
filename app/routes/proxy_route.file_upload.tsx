import { authenticate } from "../shopify.server";
import type { ActionFunctionArgs } from "react-router";
import { fetchFileUrl } from "../utils";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.public.appProxy(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized request." }, { status: 403 });
    }

    console.log("🔐 Admin Authentication Successful");

    const formData = await request.formData();
    const file = formData.get("file") as File;

    // console.log("📥 Received file:", file);

    if (!file) {
      return Response.json({ error: "No file uploaded." }, { status: 400 });
    }

    // console.log("📂 File received:", file.name, "Type:", file.type);

    // Step 1: Request a staged upload URL from Shopify
    const stagedUploadsQuery = `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          resourceUrl
          url
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }`;

    const stagedUploadsResponse = await admin.graphql(stagedUploadsQuery, {
      variables: {
        input: {
          filename: file.name,
          fileSize: file.size.toString(),
          httpMethod: "POST",
          mimeType: file.type,
          resource: "FILE",
        },
      },
    });

    const stagedUploadsData = await stagedUploadsResponse.json();
    const stagedTarget =
      stagedUploadsData?.data?.stagedUploadsCreate?.stagedTargets?.[0];

    if (!stagedTarget) {
      return Response.json(
        { error: "Failed to get a staged upload URL." },
        { status: 500 },
      );
    }

    // console.log("✅ Staged Upload URL Received:", stagedTarget.url);

    // Step 2: Upload file to Shopify's AWS S3
    const uploadFormData = new FormData();
    stagedTarget.parameters.forEach(
      ({ name, value }: { name: string; value: string }) => {
        uploadFormData.append(name, value);
      },
    );

    const fileBuffer = await file.arrayBuffer();
    const blob = new Blob([fileBuffer], { type: file.type });
    uploadFormData.append("file", blob, file.name);

    const uploadResponse = await fetch(stagedTarget.url, {
      method: "POST",
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      return Response.json({ error: "File upload to AWS S3 failed." }, { status: 500 });
    }

    console.log("📤 File uploaded successfully to S3");

    // Step 3: Register the file in Shopify Admin
    const fileCreateQuery = `mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          alt
        }
        userErrors {
          field
          message
        }
      }
    }`;

    const fileCreateResponse = await admin.graphql(fileCreateQuery, {
      variables: {
        files: [
          {
            originalSource: stagedTarget.resourceUrl,
            contentType: file.type === "application/pdf" ? "FILE" : "IMAGE",
            alt: "Custom Design File Uploaded by Customer",
          },
        ],
      },
    });

    const fileCreateResponseData = await fileCreateResponse.json();
    const uploadedFile = fileCreateResponseData?.data?.fileCreate?.files?.[0];

    if (!uploadedFile) {
      return Response.json(
        { error: "Failed to register the file in Shopify Admin." },
        { status: 500 },
      );
    }

    console.log("📌 File registered in Shopify Admin");

    // Step 4: Poll for Public URL
    try {
      const fileUrl = await fetchFileUrl(admin, uploadedFile.id);
      console.log("🔗 Public File URL:", fileUrl);

      return Response.json({
        message: "File uploaded and registered successfully!",
        url: fileUrl,
      });
    } catch (error) {
      console.error("❌ Failed to retrieve public file URL:", error);
      return Response.json(
        { error: "File uploaded but public URL is not available." },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("❌ Error uploading file:", error);
    return Response.json({ error: "File upload failed." }, { status: 500 });
  }
};
