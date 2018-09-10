const express = require('express');
const app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const ROOT = process.cwd();
const config = require(ROOT + '/config.json');
const fs = require('fs');
const path = require('path');

const DB = require('./DB');
let MainDB;
if(config.db) MainDB = new DB(config.db, config.devMode);

function getControllerScope(req, res) {
    return {
        send(msg, code = 200) {
            res.status(code);
            res.set('Content-Type', 'application/json');
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.send(JSON.stringify({
                success: code == 200,
                code,
                msg
            }, null, 4));
        },
        data: req.body,
        db: MainDB
    }
}

let loadedControllers = {};
app.all('*', function (req, res) {    
    const controllerScope = getControllerScope(req, res);
    
    const args = req.url.split('?')[0].split('/').slice(1);
    args[0] = args[0][0].toUpperCase() + args[0].slice(1);
    if (loadedControllers[args[0]]) {
        let controller = loadedControllers[args[0]];
        controller.onLoad();
        controller[args[1]].bind(controllerScope)();
    } else {
        const controllerPath = path.normalize(`${ROOT}/controllers/${args[0]}.js`);
        fs.access(controllerPath, fs.constants.F_OK, (err) => {
            if(err) {
                controllerScope.send(`API ${args[0]} controller not found.`, 404);
            } else {
                let controller = require(controllerPath);
                controller = new controller();
                config.devMode ? delete require.cache[controllerPath] : (loadedControllers[args[0]] = controller);
                controller.onLoad && controller.onLoad();
                if (controller[args[1]]) {
                    controller[args[1]].apply(controllerScope, args.slice(2));
                } else if ((!args[1] || args[1].trim() == '') && controller['undefined']) {
                    controller['undefined'].apply(controllerScope, args.slice(2));
                } else {
                    controllerScope.send(`API ${args[0]}.${args[1]} action not found.`, 404);
                }
            }
        });
    }
});

!config.port && (config.port = 8081);
app.listen(config.port, function () {
    console.log('API started at port ' + config.port);
});