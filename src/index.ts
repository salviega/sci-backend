import cors from 'cors'
import dotenv from 'dotenv'
import express, { NextFunction, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import fs from 'fs'
import helmet from 'helmet'
import morgan from 'morgan'
import multer from 'multer'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

import pinataSDK, { PinataPinOptions } from '@pinata/sdk'

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use(cors({ origin: '*' }))
app.use(helmet())
app.use(morgan('dev'))

const pinataJWTKey = process.env.PINATA_JWT
// eslint-disable-next-line new-cap
const pinata = new pinataSDK({ pinataJWTKey })
const upload = multer({ dest: 'uploads/' })

// Swagger setup
const swaggerOptions = {
	swaggerDefinition: {
		openapi: '3.0.0',
		info: {
			title: 'Express IPFS Uploader API',
			version: '0.0.1',
			description: 'API for uploading JSON and files to IPFS'
		},
		servers: [
			{
				url: `http://localhost:${port}`
			}
		]
	},
	apis: ['./src/**/*.ts'] // Path to the API docs
}

const swaggerDocs = swaggerJsdoc(swaggerOptions)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs))

/**
 * @swagger
 * /uploadJson:
 *   post:
 *     tags:
 *      - IPFS
 *     summary: Upload JSON to IPFS
 *     description: Upload a JSON object to IPFS.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *            type: object
 *            additionalProperties: true
 *            description: JSON object to upload to IPFS
 *            example:
 *             name: John Doe
 *             age: 30
 *             city: New York
 *             country: USA
 *
 *     responses:
 *       200:
 *         description: Successfully uploaded JSON to IPFS
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cid:
 *                   type: string
 *                   description: IPFS hash (CID) of the uploaded JSON
 *       400:
 *         description: Invalid JSON object
 *       500:
 *         description: Error uploading JSON to IPFS
 */

app.post(
	'/uploadJson',
	body().isObject(),
	async (req: Request, res: Response, next: NextFunction) => {
		const errors = validationResult(req)
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() })
		}

		const { body } = req
		const options: PinataPinOptions = {
			pinataMetadata: {
				name: 'test.json'
			}
		}

		try {
			const result = await pinata.pinJSONToIPFS(body, options)
			res.send(res.send(result.IpfsHash))
		} catch (error) {
			console.error(error)
			next(error)
		}
	}
)

/**
 * @swagger
 * /uploadFile:
 *   post:
 *     tags:
 *       - IPFS
 *     summary: Upload a file to IPFS
 *     description: Upload a file to IPFS.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload to IPFS
 *     responses:
 *       200:
 *         description: Successfully uploaded file to IPFS
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cid:
 *                   type: string
 *                   description: IPFS hash (CID) of the uploaded file
 *       400:
 *         description: No file uploaded
 *       500:
 *         description: Error uploading file to IPFS
 */

app.post(
	'/uploadFile',
	upload.single('file'),
	async (req: Request, res: Response, next: NextFunction) => {
		if (!req.file) {
			return res.status(400).send('No file uploaded.')
		}

		const readableStreamForFile = fs.createReadStream(req.file.path)
		const options: PinataPinOptions = {
			pinataMetadata: {
				name: req.file.originalname
			}
		}

		try {
			const result = await pinata.pinFileToIPFS(readableStreamForFile, options)
			res.send(result.IpfsHash)
		} catch (error) {
			console.error(error)
			next(error)
		}
	}
)

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error(err.stack)
	res.status(500).send('Something broke!')
})

app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`)
})
