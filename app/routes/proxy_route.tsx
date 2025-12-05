import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Use the authentication API from the React Router template
    const { admin } = await authenticate.public.appProxy(request);

    if (!admin) {
      return Response.json({ error: "Unauthorized request." }, { status: 403 });
    }

    console.log("🔐 Admin Authentication Successful");

    // Parse JSON body from the request
    const requestData = await request.json();

    // Validate input
    if (!requestData || typeof requestData !== "object") {
      return Response.json({ error: "Invalid request data." }, { status: 400 });
    }

    // Log incoming request data
    console.log("📥 Received Data:", JSON.stringify(requestData, null, 2));

    // Function to flatten nested objects in request data
    const flattenRequestData = (data: any) => {
      const flattened: any = {};

      for (const key in data) {
        if (typeof data[key] === "object" && !Array.isArray(data[key])) {
          for (const nestedKey in data[key]) {
            flattened[nestedKey] = data[key][nestedKey];
          }
        } else if (Array.isArray(data[key])) {
          flattened[key] = data[key].join(", ");
        } else {
          flattened[key] = data[key];
        }
      }

      return flattened;
    };

    // Process input data
    const flattenedData = flattenRequestData(requestData);

    console.log("📦 Flattened Data:", flattenedData);

    // Construct variables for the GraphQL request
    const variables = {
      metaobject: {
        type: "custom_sizes",
        capabilities: {
          publishable: {
            status: "ACTIVE",
          },
        },
        fields: Object.entries(flattenedData).map(([key, value]) => ({
          key,
          value: value?.toString(),
        })),
      },
    };

    console.log(
      "🔧 Constructed Variables:",
      JSON.stringify(variables, null, 2),
    );

    // Define Shopify GraphQL mutation
    const metaobjectCreateQuery = `
      mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            handle
            season: field(key: "season") {
              value
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    // Execute GraphQL request
    const response = await admin.graphql(metaobjectCreateQuery, { variables });

    // Parse response
    const metaobjectCreateData = await response.json();

    console.log(
      "📡 Shopify API Response:",
      JSON.stringify(metaobjectCreateData, null, 2),
    );

    // Handle errors from Shopify API
    if (
      metaobjectCreateData.errors ||
      metaobjectCreateData.data?.metaobjectCreate?.userErrors?.length
    ) {
      console.error(
        "🚨 Shopify API Errors:",
        JSON.stringify(metaobjectCreateData, null, 2),
      );
      return Response.json(
        {
          error: "Shopify API returned errors.",
          details:
            metaobjectCreateData.errors ||
            metaobjectCreateData.data?.metaobjectCreate?.userErrors,
        },
        { status: 500 },
      );
    }

    // Extract the created metaobject
    const metaobject = metaobjectCreateData?.data?.metaobjectCreate?.metaobject;

    if (!metaobject) {
      return Response.json(
        { error: "Failed to create metaobject entry." },
        { status: 500 },
      );
    }

    console.log("✅ Metaobject created successfully:", metaobject);

    return Response.json({
      message: "Metaobject created successfully!",
      metaobject,
    });
  } catch (error) {
    console.error("❌ Error creating metaobject:", error);
    return Response.json(
      { error: "Metaobject creation failed." },
      { status: 500 },
    );
  }
};
