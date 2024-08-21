const http = require('http');
const fs = require('fs'); // Import the fs module
const path = require('path');
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const player = require('node-wav-player');

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
    },
    unlink: function () {
        unlinkT(this);
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
const unlinkT = timelineA =>
    timelineA._fns = [];

//-------------

const port = 8777;
const projectRoot =
    '/home/ken/Documents/p/ai-electron/vanfs/build/'; // Specify the project root

const countT = Timeline(0);

const server = http.createServer((req, res) => {
    // CORSヘッダーを追加 (必要に応じて)
    res.setHeader('Access-Control-Allow-Origin', '*'); // 開発時のみ、全てのオリジンからのアクセスを許可
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    if (req.url === '/count') {
        // '/count' にアクセスされた場合
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end(countT.lastVal.toString()); // カウント値を文字列に変換して返す

    } else {
        // 他のリクエスト (ファイルの提供など)
        let filePath = path.join(projectRoot, req.url);
        if (req.url === '/') {
            filePath = path.join(projectRoot, 'index.html');
        }

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end('Not Found\n');
                } else {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end('Internal Server Error\n');
                }
                return;
            }

            let contentType = 'text/plain';
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
                // 必要に応じて他のファイルタイプを追加
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            res.end(data);
        });
    }
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
    //========================================================

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
                                // player.play({
                                //     path: './beep-ok.wav',
                                // })
                            });

                            proc.stderr.on('data', (data) => {
                                console.error(`${command[0]} stderr: ${data}`);
                                player.play({
                                    path: './beep-error.wav',
                                })
                            });

                            proc.on('close', (code) => {
                                if (code === 0) {
                                    console.log(`${command[0]} exited successfully`);
                                    player.play({
                                        path: './beep-ok.wav',
                                    })
                                    resolve();
                                } else {
                                    console.error(`${command[0]} exited with code ${code}`);
                                    reject(`${command[0]} exited with code ${code}`);

                                    player.play({
                                        path: './beep-error.wav',
                                    })
                                }
                            });
                        });
                    });
                },
                    Promise.resolve())
                    .then(() => {
                        countT.next(countT.lastVal + 1);
                    })
                    .catch((err) => {
                        console.error('Error running commands:', err);
                    });
            }

        runCommands(cwd, commandList)
            .then(() => {
                console.log('All commands executed successfully');

                player.play({
                    path: './beep-ok.wav',
                })
            })
            .catch((err) => {
                console.error('Error executing commands:', err);
                player.play({
                    path: './beep-error.wav',
                })
            });

    });
    //========================================================
});

//------------------------------------------------------------------
