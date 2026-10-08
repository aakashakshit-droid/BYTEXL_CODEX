const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const DASHBOARD_PATH = path.join(__dirname, 'student-analytics (1).html');
const DATA_DIRECTORY = path.join(__dirname, 'data');
const DATA_PATH = path.join(DATA_DIRECTORY, 'students.json');

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(payload));
}

function readStudents() {
    try {
        const saved = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        if (!Array.isArray(saved)) throw new Error('Student data file must contain an array.');
        return saved;
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

function saveStudents(students) {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
    const temporaryPath = `${DATA_PATH}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(students, null, 2), 'utf8');
    fs.renameSync(temporaryPath, DATA_PATH);
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        let tooLarge = false;
        request.on('data', chunk => {
            if (tooLarge) return;
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                tooLarge = true;
                reject(Object.assign(new Error('Request body exceeds the 5 MB limit.'), { statusCode: 413 }));
                return;
            }
            chunks.push(chunk);
        });
        request.on('end', () => {
            if (tooLarge) return;
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
                reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 }));
            }
        });
        request.on('error', reject);
    });
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);

    if (url.pathname === '/api/health' && request.method === 'GET') {
        return sendJson(response, 200, { status: 'ok' });
    }

    if (url.pathname === '/api/students' && request.method === 'GET') {
        try {
            return sendJson(response, 200, { students: readStudents() });
        } catch (error) {
            console.error('Could not read student data:', error);
            return sendJson(response, 500, { error: 'Could not read saved student data.' });
        }
    }

    if (url.pathname === '/api/students' && request.method === 'PUT') {
        try {
            const body = await readJsonBody(request);
            if (!body || !Array.isArray(body.students) ||
                !body.students.every(student => student && typeof student === 'object' && !Array.isArray(student))) {
                return sendJson(response, 400, { error: 'Expected a students array of CSV row objects.' });
            }
            saveStudents(body.students);
            return sendJson(response, 200, { students: body.students });
        } catch (error) {
            if (response.destroyed) return;
            if (error.statusCode) return sendJson(response, error.statusCode, { error: error.message });
            console.error('Could not save student data:', error);
            return sendJson(response, 500, { error: 'Could not save student data.' });
        }
    }

    if (url.pathname === '/api/students' && request.method === 'DELETE') {
        try {
            saveStudents([]);
            return sendJson(response, 200, { students: [] });
        } catch (error) {
            console.error('Could not clear student data:', error);
            return sendJson(response, 500, { error: 'Could not clear saved student data.' });
        }
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/student-analytics%20(1).html')) {
        response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
        });
        return fs.createReadStream(DASHBOARD_PATH).pipe(response);
    }

    return sendJson(response, 404, { error: 'Not found.' });
});

server.listen(PORT, HOST, () => {
    console.log(`EduPulse dashboard running at http://${HOST}:${PORT}`);
});

server.on('error', error => {
    console.error('Could not start the EduPulse server:', error);
    process.exitCode = 1;
});
