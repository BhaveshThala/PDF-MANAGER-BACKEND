var express = require('express');
const multer = require('multer');
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require('path');
var cors = require('cors');

const mergePdfDocument = require('pdf-lib').PDFDocument

const PDFDocument = require('pdfkit');

const libre = require('libreoffice-convert');
libre.convertAsync = require('util').promisify(libre.convert);

var app = express();

app.use(cors())

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true | true, parameterLimit: 1000000 }));

app.use('/output', express.static(path.join(__dirname, '/output')));

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

var outputLoc = path.join(__dirname, `output`)

app.get('/', (req, res, next) => {
    res.status(200).send({ "Success": true, "ResponseCode": 200, "Message": "Pdf Syntizen Service is up and running version 0.0.0.0.37", "Body": new Array() });
});

// api to convert any office file to pdf.
app.post("/convertFile", upload.single('inputfile'), async function (req, res) {
    var outputFileExtension = 'pdf';

    var outputFileName = `output.${outputFileExtension}`
    outputFileName = outputFileName.split('.').join('-' + Date.now() + '.');

    var outputMainLoc = path.join(outputLoc, outputFileName);

    let pdfBuf = await libre.convertAsync(req.file.buffer, outputFileExtension, undefined);

    await fs.writeFile(outputMainLoc, pdfBuf);

    res.status(200).setHeader('Content-Disposition', 'attachment; filename=' + outputFileName)
        .sendFile(outputMainLoc, function (err) {
            if (err) {
                res.status(500).send({ "Success": false, "ResponseCode": 500, "Message": err.message, "Body": new Array() });
            } else {
                fs.unlink(outputMainLoc, (errFile) => {
                    if (errFile) {
                        console.log("error in file", errFile)
                    }
                });
            }
        });
});

// api to convert any image to pdf.
app.post('/imageToPdf', upload.array('imageFiles', 100), async function (req, res, next) {
    var myDoc = new PDFDocument({ bufferPages: true });

    let buffers = [];
    myDoc.on('data', buffers.push.bind(buffers));
    myDoc.on('end', () => {

        let pdfData = Buffer.concat(buffers);
        res.writeHead(200, {
            'Content-Length': Buffer.byteLength(pdfData),
            'Content-Type': 'application/pdf',
            'Content-disposition': 'attachment;filename=imageattach.pdf',
        })
            .end(pdfData);

    });

    let i = 0;
    if (req.files) {
        req.files.forEach(file => {
            myDoc.image(file.buffer, {
                fit: [450, 500],
                align: 'center',
                valign: 'center'
            });
            if (i != req.files.length - 1) {
                myDoc.addPage();
                i++;
            }
        });
    }
    myDoc.end();
});

// api to merge multiple pdfs.
app.post('/mergePdf', upload.array('files', 100), async (req, res) => {

    const mergedPdf = await mergePdfDocument.create();
    for (const pdfBytes of req.files.map(file => file.buffer)) {
        const pdf = await mergePdfDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => {
            mergedPdf.addPage(page);
        });
    }

    const buf = await mergedPdf.save();

    res.writeHead(200, {
        'Content-Length': Buffer.byteLength(buf),
        'Content-Type': 'application/pdf',
        'Content-disposition': 'attachment;filename=merge.pdf',
    }).end(buf);
});

var port = process.env.PORT || 8000

app.listen(port, () => { console.log(`App started at port ${port}`) })