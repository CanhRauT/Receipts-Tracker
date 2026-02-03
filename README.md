# Receipt Tracker Frontend

A modern web interface for uploading and processing receipts using your Azure Function backend.

## Features

### 📸 **Desktop Camera Capture**
- Access device camera to capture receipt photos
- Uses environment-facing camera for better receipt capture
- Real-time preview before capturing

### 📄 **PDF Upload**
- Upload PDF receipt files
- Automatically converts first page to image
- Supports scanned and digital PDF receipts

### 🖼️ **Image Upload**
- Support for JPG, PNG, and other image formats
- Direct file upload from device
- Preview before processing

## Setup

### 1. Update Azure Function URL
Edit `index.html` and update the `AZURE_FUNCTION_URL` constant:
```javascript
const AZURE_FUNCTION_URL = 'https://your-actual-function-app-name.azurewebsites.net/api/ProcessReceipt';
```

### 2. Run Local Server
```bash
# Start the local development server
python server.py
```

The server will automatically open your browser at `http://localhost:8000`

### 3. Test the Application
1. Choose one of the three upload methods
2. Upload/capture your receipt
3. Preview the image
4. Click "Process Receipt" to send to Azure Function
5. View the analysis results

## Requirements

- Modern web browser with JavaScript enabled
- Camera permissions (for camera capture)
- Internet connection (to access Azure Function)
- Python 3.x (for local server)

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Security Notes

- Camera access requires HTTPS in production
- All images are processed directly by your Azure Function
- No images are stored on the frontend server

## Troubleshooting

### Camera Not Working
- Check browser permissions for camera access
- Use HTTPS in production environments
- Ensure camera is not being used by another application

### PDF Processing Issues
- Ensure PDF is not password protected
- Large PDFs may take longer to process
- Only the first page is converted

### Azure Function Connection
- Verify the function URL is correct
- Check that your Azure Function is deployed and running
- Ensure CORS is configured if needed

## File Structure

```
ReceiptTracker/
├── index.html          # Main frontend application
├── server.py           # Local development server
├── README.md           # This file
├── function_app.py     # Azure Function backend
├── requirements.txt    # Python dependencies
└── host.json          # Azure Function configuration
```

## Development

To modify the frontend:
1. Edit `index.html`
2. Refresh your browser to see changes
3. Use browser developer tools for debugging

The frontend uses:
- Tailwind CSS for styling
- Font Awesome for icons
- PDF.js for PDF processing
- Vanilla JavaScript for functionality
