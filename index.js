const http = require('http');
const fs = require('fs'); // Import the fs module
const path = require('path');
const { spawn } = require('child_process');
const chokidar = require('chokidar');

//-------------

const Timeline = (initialValue) => ({
    lastVal: initialValue,
    _fns: [],
    next: function (a) {
        nextT(a)(this);
    },
    bind: function (monadf) {
        return bindT(monadf)(this);
    },
    map: function (f) {
        return mapT(f)(this);
    }
});
const nextT = a => timeline => {
    timeline.lastVal = a;
    timeline._fns.forEach(f => f(a));
};
const bindT = (monadf) => (timelineA) => {
    const timelineB = monadf(timelineA.lastVal);
    const newFn = (a) => {
        const timeline = monadf(a);
        nextT(timeline.lastVal)(timelineB);
    };
    timelineA._fns.push(newFn);
    return timelineB;
};
const mapT = (f) => (timelineA) => {
    const timelineB = Timeline(f(timelineA.lastVal));
    const newFn = (a) =>
        nextT(f(a))(timelineB);
    timelineA._fns.push(newFn);
    return timelineB;
};

//-------------

const reloadT = Timeline(undefined);

const port = 3000;
const projectRoot =
    '/home/ken/Documents/p/ai-electron/vanfs/build/'; // Specify the project root

const server = http.createServer((req, res) => {
    // Get the path of the requested file
    let filePath = path.join(projectRoot, req.url); // Resolve the relative path from the project root
    // Access to the root path ('/') returns the index.html
    if (req.url === '/') {
        filePath = path.join(projectRoot, 'index.html');
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            // If the file doesn't exist, return a 404 error
            if (err.code === 'ENOENT') {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Not Found\n');
            } else {
                // For other errors, return a 500 error
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Internal Server Error\n');
            }
            return;
        }
        // Set the Content-Type header based on the file extension
        let contentType = 'text/plain'; // Default Content-Type
        switch (path.extname(filePath)) {
            case '.html':
                contentType = 'text/html';
                break;
            case '.css':
                contentType = 'text/css';
                break;
            case '.js':
                contentType = 'text/javascript';
                break;
            // Add other file types as needed
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.end(data);
    });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
    //========================================================

    const url = 'http://localhost:3000/';
    const watchFiles = '/home/ken/Documents/p/ai-electron/vanfs/Program.fs';

    // Start file monitoring
    chokidar.watch(watchFiles).on('change', (path) => {
        console.log(`File ${path} has been changed`);

        const cwd = '/home/ken/Documents/p/ai-electron/vanfs/';
        const commandList = [
            'dotnet fable',
            'npx vite build'
        ];
        const runCommands =
            (cwd, commandList) => {
                const commands =
                    commandList.map(commandString =>
                        commandString.trim().split(/\s+/));

                return commands.reduce((promise, command) => {
                    return promise.then(() => {
                        return new Promise((resolve, reject) => {
                            const proc = spawn(command[0], command.slice(1), { cwd });

                            proc.stdout.on('data', (data) => {
                                console.log(`${command[0]} stdout: ${data}`);
                            });

                            proc.stderr.on('data', (data) => {
                                console.error(`${command[0]} stderr: ${data}`);
                            });

                            proc.on('close', (code) => {
                                if (code === 0) {
                                    console.log(`${command[0]} exited successfully`);
                                    resolve();
                                } else {
                                    console.error(`${command[0]} exited with code ${code}`);
                                    reject(`${command[0]} exited with code ${code}`);
                                }
                            });
                        });
                    });
                },
                    Promise.resolve())
                    .then(() => {
                        reloadT.next(true);
                    })
                    .catch((err) => {
                        console.error('Error running commands:', err);
                    });
            }

        runCommands(cwd, commandList)
            .then(() => {
                console.log('All commands executed successfully');
            })
            .catch((err) => {
                console.error('Error executing commands:', err);
            });

    });
    //========================================================
});

//------------------------------------------------------------------


// サーバー側 (Node.js)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server }); // http.createServer と同じ server を使う

wss.on('connection', (ws) => {
    console.log('Client connected');

    reloadT.map(a =>
        (a === undefined)
        ? undefined
        : ws.send('reload') // クライアントにリロードメッセージを送信
    );

});