# ![Alt text](spliffy_logo_text_small_1.png?raw=true "Spliffy Logo")

> Node web framework with apache like dir based route config to get you lit quick

## Getting started
Create a directory for your api and a root directory for your routes

```mkdir -p ~/api/www```

Install spliffy

```cd ~/api && npm install --save spliffy```

Then create a handler js file in that directory with the name of the end point. 

```vi ~/api/www/spliffy.js```
```js
module.exports = {
    GET: () => "hello spliffy"
}
```

Create the start script, ```vi ~/api/serve.js```, routeDir should be an absolute path. 
```js
require('spliffy')({routeDir: __dirname+ '/www'})
```

start the server
```node ~/api/serve.js```

Make a request to ```localhost:10420/spliffy```

#### The request Handler
```js
module.exports = {
    GET: (url, body, headers, req) => {        
        body: "hello world"
    }
}
```

The exported function names are request methods, any request method is allowed, **but must be all caps**

Files named index.js can be created to handle the route of the name of the folder just like in apache.

Handler arguments:
- **url**: An object containing path and parameter information about the url
    - **path**: The path of the current request
    - **query**: An object containing the query parameters
    - **pathParameters**: parameters that are part of the path
- **body**: The body of the request
- **headers**: The request headers from the node request object
- **req**: The un-adulterated node IncomingMessage request object

The handler can return any kind of data and it will be serialized automatically.

You can return a promise and the server will respond with the resolved object.

If you need to set the statusCode, headers, etc, you must return an object with a body property for the body and one or more of the following properties
```js
{
    headers: {
        "cache-control": 'no-cache'
    },
    body: {
        some: 'object'
    },
    statusCode: 420,
    statusMessage: "Enhance Your Calm"
}
```

## Config
```js
{
    port: 10420,
    routeDir: './www',
    routePrefix: "api",
    filters: [
        ( url, req, reqBody, res, handler) => {
            res.finished = true
        }
    ]
    acceptsDefault: "*/*",
    defaultContentType: "*/*",
    contentHandlers: {
        'application/json': {
            read: requestBody => JSON.parse(requestBody),
            write: responseBody => JSON.stringify(responseBody)
        }
    }
}
```

- **port**: The port for the server to listen on
- **routeDir**: The directory the routes are contained in, should be an absolute path
- **routePrefix**: A prefix that will be included at the beginning of the path for every request. 
            For example, a request to /foo becomes /routePrefix/foo
- **filters**: An array of functions to filter incoming requests
    - **url**: See handler url argument
    - **req**: The un-adulterated node IncomingMessage request object
    - **reqBody**: The original unmodified request body
    - **res**: The un-adulterated node ServerResponse response object
    - **handler**: The request handler that will handle this request
- **acceptsDefault**: The default mime type to use when accepting a request body. */* will convert objects from json by default
- **defaultContentType**: The default mime type to use when writing content to a response. will convert objects to json by default
- **contentHandlers**: Content negotiation handlers. mime types must be lower case.
    - **read**: A method to convert the request body to an object 
    - **write**: A method to convert the response body to a string


#### A note on Filters
Filters can prevent the request from being handled by setting res.finished = true. This will short-circuit the filters
and return immediately as soon as it has been set.

## Routes
Routes are based entirely on their directory structure much like they are in apache.

Example dir:
- www
    - strains
        - gorillaGlue.js
        - blueDream.js
        - indica
            - index.js
        - sativa
            - index.js
            - smokeit.js
        - index.js

This would create the following route mappings:
- /strains/ > /www/strains/index.js
- /strains/gorillaGlue > /www/strains/gorillaGlue.js
- /strains/blueDream > /www/strains/blueDream.js
- /strains/indica/ > /www/strains/indica/index.js
- /strains/sativa/ > /www/strains/sativa/index.js
- /strains/sativa/smokeit > /www/strains/sativa/smokeit.js

#### Path variables
You can include path variables by prefixing the folder or file name with a $

Example dir:
- www
    - strains
        - $strainName
            - info

would handle:

- /www/strains/gorillaGlue/info
- /www/strains/blueDream/info

The path parameters are available in the pathParameters object on the first argument passed to the handler

The variable will be the folder or file name excluding the $, i.e. $strainName -> { strainName: 'gorillaGlue'}

**You can only have on variable file/folder within any given folder. This is because it would be ambiguous which one to use and thus the result couldn't be defined. 

#### Catchall path
You can make a handler handle all requests that start with the given path by appending a + to the file or folder name.

Example dir:
- www
    - strains+.js

would handle:

- /www/strains/gorillaGlue/info/something/more/stuff
- /www/strains/blueDream/dankness/allOfIt

#####Feature backlog (ordered by priority)
- ssl w/letsEncrypt certificate support
- authentication/authorization filter with default and per handler configuration
- compression
- redirect helper function
- caching filter
- more robust content handling
- multipart file handling
- static file handling