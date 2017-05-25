# question-component-editor-example

This is an example application that interacts with a Corespring Question component editor when contentStorage is set to 'none'. 

The example application stores all the data and assets - corespring stores nothing.

This is done by setting 2 properties in the question component editor launch options: 

* setting `contentStorage` to 'none'
* setting `uploadUrl` to a url that consumes a multipart form request with a single control: 'file'. The 'file' control also contains the file name in `Content-Disposition: filename`. See the docs for more information on the asset endpoints should be implemented.

## Configuration

The app has a few dependencies that you'll need to set up: 

* A mongo db (with a user you can use to log in)
* An S3 bucket

For ease of development the app is configured with defaults so that it will run straight away against the corespring test application (aka no auth required).

To configure for any other environment you'll need to set up the db and bucket and then set the following env vars: 

* LAUNCH_EXAMPLE_BUCKET - the name of an existing s3 bucket on which to store the assets (default: component-editor-launch-examples)

* MONGO_URI - a mongo uri that stores `users` and `items` (default: mongodb://localhost/question-component-editor-example)

* COMPONENT_EDITOR_HOST - the host of the component editor - this is needed to set `Access-Control-Allow-Origin` (default: http://localhost:9000)

* COMPONENT_EDITOR_JS_PATH - the absolute path to the `component-editor.js` file.

## Users

The users collection is used for authentication.

> You have to create the users collection yourself, the app doesn't boot with one.
 
A user has the following schema: 

```js
    
    { 
      //required
      username: '', 
      //required - note that this is plaintext. not for use in production.
      password: '', 
      //required if running against platform.corespring.org - a clientId for an ApiClient
      clientId: '', 
      //required if running against platform.corespring.org - a clientSecret for an ApiClient
      clientSecret: ''
    }
```


## Running against corespring-api


```bash
# make sure you have a user with an apiClient and secret
export NODE_ENV=cs-api
npm start

```
To run against platform.corespring.org a few extra steps are required.

* set `CONTEXT` to 'corespring-api' - so the app knows it needs to create a player token.

* make sure that you have a valid `clientId` and `clientSecret` defined for your user - this should be an id/secret for an `ApiClient` you have on `platform.corespring.org`. This is required to create the player token used to launch the editor.


```

# Install

```
     
    npm install
```

# Run

```

    npm start
```

# Test

```
    export NODE_ENV=test
    mocha test/integration
```

# Dev (reload)

```

    nodemon bin/www
```

# Debug

```

    node-debug bin/www
```

# Logs 

```
   export DEBUG="app:routes,..."
   npm start
```
