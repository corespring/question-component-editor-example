# question-component-editor-example

This is an example application that interacts with a Corespring Question component editor when contentStorage is set to 'none'. 

The example application stores all the data and assets - corespring stores nothing.

## Configuration

The app is configured with defaults to allow a developer to run it straight away against the corespring test application (aka no auth required).

For deployment you must configure the following: 

* LAUNCH_EXAMPLE_BUCKET - the name of an existing s3 bucket on which to store the assets (default: component-editor-launch-examples)

* MONGO_URI - a mongo uri that stores `users` and `items` (default: mongodb://localhost/question-component-editor-example)

* COMPONENT_EDITOR_HOST - the host of the component editor - this is needed to set `Access-Control-Allow-Origin` (default: http://localhost:9000)

* COMPONENT_EDITOR_JS_PATH - the absolute path to the `component-editor.js` file.

## Users

The users collection is used for authentication.

> You have to create the users collection yourself, the app doesnt boot with one.
 
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

## Running against corespring-api

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
