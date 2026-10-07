# Ejs-ex usage 
A templating package similar to ejs but with built in layout and scoped include variables.

## Ejs-ex usage
```js
const express = require("express");
const path = require("path");

const { renderFile, registerHelper } = require("./lib/dist/index");

const app = express();

app.engine("html", renderFile); //Set the engine to any extention, i.e. html, ejs, etc
app.set("views", path.join(__dirname, "views")); Indicate path to folder containg view files
app.set("view engine", "html");
// 
registerHelper("upper", str => String(str).toUpperCase()); //registering globla helper functions
registerHelper("lower", str => String(str).toLowerCase());
// 
app.get("/", (req, res) => { 

    res.render("index", {
        name: "Alexy", //passing string 
        students: [{name: "Tom",age: 20}], //passing array of data
        layout: "layout/main", //path of layout file called main
        greet:(name)=> `Hello ${name}!` //function
        
    });
});

const port = 8000
app.listen(8000);

```
### In the layout file

```js
<!DOCTYPE html>
<html>
<head>
    <title><%= title %></title>
</head>
<body>

    <%- body %>

</body>
</html>
```
### In the individual file
Design you individual page

```js

<%- include("partial/header", { name: "tom" }) %>
<p><%= greet(name) %></p>

<ul>
    <% students.map(student => { %>
        <li>
            <%= student.name %> - <%= student.age %>
        </li>
    <% }) %>
</ul>

```
The rest of the codes are the ejs codes.