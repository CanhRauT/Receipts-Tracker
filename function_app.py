import logging
import os
import uuid
import json
import azure.functions as func

# Import the clients for the Azure services
from azure.storage.blob import BlobServiceClient
from azure.cosmos import CosmosClient
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

# v2 model: Create a FunctionApp instance
# Set the authorization level to Anonymous to make local testing easier
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# v2 model: Use a decorator to define the trigger
# This says: "This function is an HTTP endpoint available at the URL path /api/ProcessReceipt"
@app.route(route="ProcessReceipt", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def ProcessReceipt(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    # 1. --- GET CONFIGURATION SETTINGS ---
    # This part is identical to the v1 model
    try:
        storage_connection_string = os.environ["STORAGE_CONNECTION_STRING"]
        cosmos_connection_string = os.environ["COSMOS_CONNECTION_STRING"]
        ai_endpoint = os.environ["AI_ENDPOINT"]
        ai_key = os.environ["AI_KEY"]
    except KeyError as e:
        logging.error(f"Missing configuration setting: {e}")
        return func.HttpResponse("Server configuration error.", status_code=500)

    # 2. --- RECEIVE THE IMAGE ---
    # This part is identical to the v1 model
    try:
        image_file = req.files['image']
        image_bytes = image_file.stream.read()
        logging.info(f"Received image: {image_file.filename}")
    except KeyError:
        return func.HttpResponse(
             "Please pass an image file in the 'image' field of the form data.",
             status_code=400
        )
    except Exception as e:
        logging.error(f"Error reading image file: {e}")
        return func.HttpResponse("Error processing image file.", status_code=500)

    # 3. --- UPLOAD IMAGE TO BLOB STORAGE ---
    # This part is identical to the v1 model
    blob_name = f"receipts/{str(uuid.uuid4())}-{image_file.filename}"
    
    try:
        blob_service_client = BlobServiceClient.from_connection_string(storage_connection_string)
        blob_client = blob_service_client.get_blob_client(container="receipts", blob=blob_name)
        
        logging.info(f"Uploading to Azure Storage as blob: {blob_name}")
        blob_client.upload_blob(image_bytes, overwrite=True)
        
        image_url = blob_client.url
        logging.info(f"Image uploaded to: {image_url}")

    except Exception as e:
        logging.error(f"Error uploading to blob storage: {e}")
        return func.HttpResponse("Error uploading file to storage.", status_code=500)

    # 4. --- ANALYZE RECEIPT WITH DOCUMENT INTELLIGENCE ---
    # This part is identical to the v1 model
    try:
        document_analysis_client = DocumentAnalysisClient(
            endpoint=ai_endpoint, credential=AzureKeyCredential(ai_key)
        )
        
        logging.info("Analyzing document with Document Intelligence...")
        poller = document_analysis_client.begin_analyze_document_from_url(
            "prebuilt-receipt", document_url=image_url
        )
        receipts = poller.result()
        logging.info("Analysis complete.")

        analyzed_receipt = receipts.documents[0]

        merchant_name = analyzed_receipt.fields.get("MerchantName")
        transaction_date = analyzed_receipt.fields.get("TransactionDate")
        total = analyzed_receipt.fields.get("Total")

        extracted_data = {
            "merchantName": merchant_name.value if merchant_name else "N/A",
            "transactionDate": str(transaction_date.value) if transaction_date else "N/A",
            "total": total.value if total else 0.0,
            "originalImageUrl": image_url,
            "id": str(uuid.uuid4())
        }
        logging.info(f"Extracted data: {extracted_data}")

    except Exception as e:
        logging.error(f"Error during document analysis: {e}")
        return func.HttpResponse("Error analyzing the receipt.", status_code=500)

    # 5. --- SAVE DATA TO COSMOS DB ---
    try:
        cosmos_client = CosmosClient.from_connection_string(cosmos_connection_string)
        
        # Create database if it doesn't exist
        logging.info("Getting or creating database...")
        database_client = cosmos_client.create_database_if_not_exists(id="receipt-db")
        
        # Create container if it doesn't exist
        logging.info("Getting or creating container...")
        container_client = database_client.create_container_if_not_exists(
            id="expenses",
            partition_key={"paths": ["/id"], "kind": "Hash"},
            offer_throughput=400
        )
        
        logging.info("Saving data to Cosmos DB...")
        container_client.create_item(body=extracted_data)
        logging.info("Data saved successfully.")

    except Exception as e:
        logging.error(f"Error saving to Cosmos DB: {e}")
        return func.HttpResponse("Error saving expense data.", status_code=500)


    # 6. --- RETURN SUCCESS RESPONSE ---
    # This part is identical to the v1 model
    return func.HttpResponse(
        json.dumps(extracted_data),
        status_code=200,
        mimetype="application/json"
    )