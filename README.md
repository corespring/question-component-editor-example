# component-editor-launch-examples

This is an example application that interacts with a Corespring standalone component editor. It allows you to store assets uploaded via the component editor.

It stores the assets on s3.

It provides the following endpoints: 

```

    POST   /image/:filename
    GET    /image/:filename
    DELETE /image/:filename
```

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