-- Test 1: Check latest design
SELECT id, title, status, "createdAt", "architectId" 
FROM "Design" 
ORDER BY "createdAt" DESC 
LIMIT 1;

-- Test 2: Check design files
SELECT df.id, df."designId", df.type, df."originalFileName"
FROM "DesignFile" df
JOIN "Design" d ON df."designId" = d.id
ORDER BY d."createdAt" DESC, df."createdAt" DESC
LIMIT 5;

-- Test 3: Check purchases
SELECT p.id, p."designId", p."buyerId", p.amount, p."createdAt"
FROM "Purchase" p
ORDER BY p."createdAt" DESC
LIMIT 3;

-- Test 4: Check architect earnings
SELECT ae.id, ae."designId", ae.amount, ae.status
FROM "ArchitectEarning" ae
ORDER BY ae."createdAt" DESC
LIMIT 3;
