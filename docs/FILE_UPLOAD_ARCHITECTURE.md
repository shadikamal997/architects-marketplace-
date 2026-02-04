# File Upload System Architecture

## Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                          │
│                                                                     │
│  FormData with:                                                     │
│  • mainPackage: design.zip (required, 1 file)                      │
│  • images: [img1.jpg, img2.png, img3.webp] (required, min 3)      │
│  • assets3d: [model.fbx, model.obj] (optional)                    │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ POST /architect/designs/:id/files
                             │ Authorization: Bearer {token}
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    MIDDLEWARE LAYER                                 │
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   requireAuth   │→ │  requireRole     │→ │   uploadFields   │  │
│  │   (JWT check)   │  │  (ARCHITECT)     │  │   (Multer)       │  │
│  └─────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Files uploaded to temp location
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    VALIDATION LAYER                                 │
│                                                                     │
│  1. Verify design exists & architect is owner                      │
│  2. Verify design status = DRAFT                                   │
│  3. Validate file sizes (per-field limits)                         │
│  4. Validate file requirements:                                    │
│     • 1 main package (ZIP)                                         │
│     • Min 3 preview images                                         │
│     • Optional 3D assets                                           │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ All validations passed
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    FILE PROCESSING LAYER                            │
│                                                                     │
│  • Map files to DesignFile records                                 │
│  • Generate storage keys                                           │
│  • Set file types (MAIN_PACKAGE, PREVIEW_IMAGE, THREE_D_ASSET)    │
│  • Assign display order to images                                  │
│  • Mark preview images as public                                   │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Create DB records
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    DATABASE LAYER                                   │
│                                                                     │
│  prisma.designFile.createMany({                                    │
│    data: [                                                          │
│      {                                                              │
│        designId: "uuid",                                           │
│        uploadedByArchitectId: "uuid",                              │
│        fileType: "MAIN_PACKAGE",                                   │
│        originalFileName: "Modern Villa.zip",                       │
│        storageKey: "/uploads/designs/{id}/main/villa-123.zip",    │
│        fileSize: 45000000,                                         │
│        mimeType: "application/zip",                                │
│        isPublicPreview: false                                      │
│      },                                                             │
│      { ... images ... },                                           │
│      { ... 3D assets ... }                                         │
│    ]                                                                │
│  })                                                                 │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Return success response
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                         RESPONSE                                    │
│                                                                     │
│  {                                                                  │
│    "success": true,                                                │
│    "message": "Files uploaded successfully",                       │
│    "files": {                                                       │
│      "mainPackage": { id, fileName, size, ... },                  │
│      "images": [{ id, fileName, size, order }, ...],              │
│      "assets3d": [{ id, fileName, size }, ...],                   │
│      "totalSize": 123456789,                                       │
│      "totalCount": 5                                               │
│    },                                                               │
│    "uploadedCount": 5                                              │
│  }                                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Storage Structure

```
uploads/
└── designs/
    └── {designId}/
        ├── main/
        │   └── modern-villa-1738631234567-abc123.zip
        │
        ├── images/
        │   ├── front-view-1738631234567-def456.jpg      [order: 0]
        │   ├── interior-1738631234567-ghi789.png        [order: 1]
        │   └── aerial-1738631234567-jkl012.webp         [order: 2]
        │
        └── 3d/
            ├── model-1738631234567-mno345.fbx
            └── model-1738631234567-pqr678.obj
```

## Database Schema

```
DesignFile
┌─────────────────────────┬──────────────────────┬─────────────────┐
│ id (UUID)              │ designId (UUID)      │ fileType        │
├─────────────────────────┼──────────────────────┼─────────────────┤
│ abc123...              │ design-uuid-1        │ MAIN_PACKAGE    │
│ def456...              │ design-uuid-1        │ PREVIEW_IMAGE   │
│ ghi789...              │ design-uuid-1        │ PREVIEW_IMAGE   │
│ jkl012...              │ design-uuid-1        │ PREVIEW_IMAGE   │
│ mno345...              │ design-uuid-1        │ THREE_D_ASSET   │
│ pqr678...              │ design-uuid-1        │ THREE_D_ASSET   │
└─────────────────────────┴──────────────────────┴─────────────────┘

Additional Fields:
• uploadedByArchitectId (UUID)
• originalFileName (String)
• storageKey (String, unique)
• fileSize (Int)
• mimeType (String)
• isPublicPreview (Boolean)
• displayOrder (Int, nullable)
• createdAt (DateTime)
```

## Security Matrix

```
┌──────────────────────┬─────────┬─────────┬─────────┬─────────┐
│ Action               │ No Auth │ Buyer   │ Arch    │ Owner   │
├──────────────────────┼─────────┼─────────┼─────────┼─────────┤
│ Upload files         │   ❌    │   ❌    │   ❌    │   ✅    │
│ List files           │   ❌    │   ❌    │   ❌    │   ✅    │
│ Delete files         │   ❌    │   ❌    │   ❌    │   ✅    │
│                      │         │         │         │         │
│ Upload when DRAFT    │   ❌    │   ❌    │   ❌    │   ✅    │
│ Upload when SUBMIT   │   ❌    │   ❌    │   ❌    │   ❌    │
│ Upload when APPROVED │   ❌    │   ❌    │   ❌    │   ❌    │
│                      │         │         │         │         │
│ Download main pkg    │   ❌    │   ✅*   │   ❌    │   ✅    │
│ View preview images  │   ✅*   │   ✅    │   ✅    │   ✅    │
│ Download 3D assets   │   ❌    │   ✅*   │   ❌    │   ✅    │
└──────────────────────┴─────────┴─────────┴─────────┴─────────┘

* Only if design is PUBLISHED and buyer has active license
```

## File Type Limits

```
┌──────────────────┬──────────────┬─────────────┬──────────────┐
│ File Type        │ Max Size     │ Max Count   │ Required     │
├──────────────────┼──────────────┼─────────────┼──────────────┤
│ Main Package     │ 500 MB       │ 1           │ Yes          │
│ Preview Images   │ 10 MB each   │ 10          │ Yes (min 3)  │
│ 3D Assets        │ 100 MB each  │ 10          │ No           │
├──────────────────┼──────────────┼─────────────┼──────────────┤
│ Total Files      │ ~2 GB        │ 21          │ -            │
└──────────────────┴──────────────┴─────────────┴──────────────┘
```

## Extension Points

### 1. S3 Storage (Future)
```javascript
// Current: Local disk
const storage = multer.diskStorage({ ... });

// Future: S3
const storage = multerS3({
  s3: s3Client,
  bucket: process.env.S3_BUCKET,
  acl: 'private',
  key: (req, file, cb) => {
    cb(null, `designs/${designId}/${folder}/${filename}`);
  }
});
```

### 2. Virus Scanning
```javascript
router.post('/designs/:id/files',
  uploadFields,
  async (req, res, next) => {
    for (const file of Object.values(req.files).flat()) {
      const result = await scanFile(file.path);
      if (!result.clean) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Virus detected' });
      }
    }
    next();
  },
  async (req, res) => { ... }
);
```

### 3. Image Watermarking
```javascript
if (file.fieldname === 'images') {
  await sharp(file.path)
    .composite([{
      input: watermarkBuffer,
      gravity: 'southeast'
    }])
    .toFile(file.path + '.watermarked');
  
  fs.renameSync(file.path + '.watermarked', file.path);
}
```

### 4. CDN Integration
```javascript
// After upload to S3
await cloudfront.createInvalidation({
  DistributionId: CDN_ID,
  InvalidationBatch: {
    Paths: { Items: [`/designs/${designId}/*`] }
  }
});
```
