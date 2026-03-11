# FILE: api/app.py
# This is the corrected version.

import logging
import os
import uuid
import json
import azure.functions as func
from azure.storage.blob import BlobServiceClient
from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosResourceNotFoundError
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# This function was already correct
@app.route(route="ProcessReceipt", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def ProcessReceipt(req: func.HttpRequest) -> func.HttpResponse:
    # ... (no changes needed inside this function) ...
    logging.info('Python HTTP trigger function processed a request.')
    # 1. --- GET CONFIGURATION SETTINGS ---
    try:
        storage_connection_string = os.environ["STORAGE_CONNECTION_STRING"]
        cosmos_connection_string = os.environ["COSMOS_CONNECTION_STRING"]
        ai_endpoint = os.environ["AI_ENDPOINT"]
        ai_key = os.environ["AI_KEY"]
    except KeyError as e:
        logging.error(f"Missing configuration setting: {e}")
        return func.HttpResponse("Server configuration error.", status_code=500)
    # 2. --- RECEIVE THE IMAGE ---
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
        database_client = cosmos_client.create_database_if_not_exists(id="receipt-db")
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
    return func.HttpResponse(
        json.dumps(extracted_data),
        status_code=200,
        mimetype="application/json"
    )

# CHANGE: Added auth_level=func.AuthLevel.ANONYMOUS
@app.route(route="GetReceipts", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def GetReceipts(req: func.HttpRequest) -> func.HttpResponse:
    # ... (no changes needed inside this function) ...
    logging.info('GetReceipts function processed a request.')
    try:
        cosmos_connection_string = os.environ["COSMOS_CONNECTION_STRING"]
        cosmos_client = CosmosClient.from_connection_string(cosmos_connection_string)
        database_client = cosmos_client.get_database_client("receipt-db")
        container_client = database_client.get_container_client("expenses")
        items = list(container_client.query_items(
            query="SELECT * FROM c ORDER BY c._ts DESC",
            enable_cross_partition_query=True
        ))
        return func.HttpResponse(json.dumps(items), status_code=200, mimetype="application/json")
    except Exception as e:
        logging.error(f'Error in GetReceipts: {e}')
        return func.HttpResponse("Failed to retrieve receipts.", status_code=500)

# CHANGE: Added auth_level=func.AuthLevel.ANONYMOUS
@app.route(route="DeleteReceipt/{id}", methods=["DELETE"], auth_level=func.AuthLevel.ANONYMOUS)
def DeleteReceipt(req: func.HttpRequest) -> func.HttpResponse:
    # ... (no changes needed inside this function) ...
    receipt_id = req.route_params.get('id')
    logging.info(f'DeleteReceipt function processing request for ID: {receipt_id}')
    if not receipt_id:
        return func.HttpResponse("Please provide a receipt ID in the URL path.", status_code=400)
    
    try:
        cosmos_connection_string = os.environ["COSMOS_CONNECTION_STRING"]
        cosmos_client = CosmosClient.from_connection_string(cosmos_connection_string)
        database_client = cosmos_client.get_database_client("receipt-db")
        container_client = database_client.get_container_client("expenses")
        container_client.delete_item(item=receipt_id, partition_key=receipt_id)
        return func.HttpResponse(status_code=204)
    except CosmosResourceNotFoundError:
        return func.HttpResponse(f"Receipt with id '{receipt_id} not found.", status_code=404)
    except Exception as e:
        logging.error(f"Error in DeleteReceipt: {e}")
        return func.HttpResponse("Failed to delete receipt.", status_code=500)

# CHANGE: Added auth_level=func.AuthLevel.ANONYMOUS
@app.route(route="DeleteMultipleReceipts", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def DeleteMultipleReceipts(req: func.HttpRequest) -> func.HttpResponse:
    # ... (no changes needed inside this function) ...
    logging.info('DeleteMultipleReceipts function processed a request.')
    
    try:
        req_body = req.get_json()
        receipt_ids = req_body.get('ids')
        if not isinstance(receipt_ids, list) or not receipt_ids:
            return func.HttpResponse("Please provide a JSON array of 'ids' in the request body.", status_code=400)
    except ValueError:
        return func.HttpResponse("Invalid JSON in request body.", status_code=400)
    logging.info(f"Attempting to delete {len(receipt_ids)} receipts.")
    
    deleted_count = 0
    errors = []
    try:
        cosmos_connection_string = os.environ["COSMOS_CONNECTION_STRING"]
        cosmos_client = CosmosClient.from_connection_string(cosmos_connection_string)
        database_client = cosmos_client.get_database_client("receipt-db")
        container_client = database_client.get_container_client("expenses")
        for receipt_id in receipt_ids:
            try:
                container_client.delete_item(item=receipt_id, partition_key=receipt_id)
                deleted_count += 1
            except CosmosResourceNotFoundError:
                logging.warning(f"Receipt with ID {receipt_id} not found, skipping.")
                errors.append({"id": receipt_id, "error": "Not Found"})
            except Exception as e:
                logging.error(f"Failed to delete receipt {receipt_id}: {e}")
                errors.append({"id": receipt_id, "error": str(e)})
        response_body = {
            "totalRequested": len(receipt_ids),
            "successfullyDeleted": deleted_count,
            "errors": errors
        }
        
        return func.HttpResponse(json.dumps(response_body), status_code=200, mimetype="application/json")
    except Exception as e:
        logging.error(f"Major error in DeleteMultipleReceipts: {e}")
        return func.HttpResponse("An unexpected error occurred during bulk deletion.", status_code=500)