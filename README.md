# question-component-editor-example

This is an example application that interacts with a Corespring Question component editor when contentStorage is set to 'none'. 

The example application stores all the data and assets - corespring stores nothing.

## Configuration

The app is configured with defaults to allow a developer to run it straight away.

For deployment you must configure the following: 

* LAUNCH_EXAMPLE_BUCKET - the name of an existing s3 bucket on which to store the assets (default: component-editor-launch-examples)

* MONGO_URI - a mongo uri that stores `users` and `items` (default: mongodb://localhost/question-component-editor-example)

* COMPONENT_EDITOR_HOST - the host of the component editor - this is needed to set `Access-Control-Allow-Origin` (default: http://localhost:9000)

* COMPONENT_EDITOR_JS_URL - the complete path to component-editor js (this only works against the container atm [will add support for cs-api soon]) (default: http://localhost:9000/client/component-editor.js)


# Install

```
     
    npm install
```

# Run

```

    npm start
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
Then configure the standalone component editor to use this url.