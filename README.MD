# Animal to Map

by Anna Marín and May Castells

## Project description:

In this project, we created a simple web service that uses four APIs (ebirb,open street map,Ninjas API, and Animal Detect) to get information about animals and maps. The web service backend is built with FastAPI and the frontend with React. We started with a GitHub simple template for FastAPI and React applications that the teacher showed us in class and then we added the required features and modified some behaviors to fit our needs.

## Installation and deployment

### Execute cookiecutter

Cookiecutter is a generator that will ask for the information of your project. Execute cookiecutter and answer the questions provided. You might want to have these on hand before generating the project.

You can look up and change the questions if needed in `cookiecutter-config-file.yml`

Dont worry you can change your answers in the .env file that will be generated

```
pip install cookiecutter
cookiecutter https://github.com/mongodb-labs/full-stack-fastapi-mongodb.git
```

After the cookiecutter script is completed, you should go to your project folder and build the project containers:

```
docker-compose build --no-cache
```

and start them:

```
docker-compose up --build
```

## How to use

First of all, make sure to put the different API keys into the `.dev` file

Then start the application with docker and go to the app page (http://localhost:3000 by default).
