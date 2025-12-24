from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from typing import List, Optional
from enum import IntEnum
from models import FileSchema, RegisterRequest, LoginSchema, ProjectSchema
from database import users, projects, files
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field

app = FastAPI()
## JWT Encryption
HIDDEN_KEY = "3e38b9db032be263014705de8645bc79"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
# Hashing password
def hash_password(password: str):
    return pwd_context.hash(password)
 
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# JWT token creation
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, HIDDEN_KEY, algorithm=ALGORITHM)

# Verify Token
def get_current_user(token: str = oauth2_scheme):
    try:
        payload = jwt.decode(token, HIDDEN_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None or username not in users:
            raise HTTPException(status_code=401, detail="Invalid authentication")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    
@app.post('/auth/register')
def register(payload: RegisterRequest):
    if payload.username in users:
        raise HTTPException(status_code = 400, detail="User already exists")
    hashed = hash_password(payload.password)
    users[payload.username] = hashed
    return {"message" : "User Registration Sucessful"}   

@app.post('/auth/login')
def login(payload: LoginSchema):
    if payload.username not in users:
        raise HTTPException(status_code = 400, detail="Incorrect Login")
    
    hashed_pw = users[payload.username]
    if not verify_password(payload.password, hashed_pw):
        raise HTTPException(status_code=400, detail="Incorrect Login")
    
    access_token = create_access_token({"sub": payload.username})

    return {"access token": access_token, "token_type": "bearer"}

@app.get('/auth/me')
def me(current_user: str = Depends(get_current_user)):
    return {"user" : "example_user"}

#############################

@app.post('/projects')
def projects(project: ProjectSchema):
    projects[projects.id] = project
    return {"message" : "Project Created", "project" : project}


@app.get('/projects')
def getProjects():
    return list(projects.values())

@app.get('/projects/{id}')
def getSpecificProjects(id: int):
    if id not in projects:
        raise HTTPException(status_code = 404, detail= "Not Found")
    return projects[id]
    

@app.put('/projects/{id}')
def updateProjects(id: int, project: ProjectSchema):
    projects[id] = project
    return {"message" : "Project Updated"} 

@app.delete('/projects/{id}')
def deleteProject(id: int):
    projects.pop(id, None)
    return {"message" : "Project Deleted"}
    
#############################

@app.post('/files')
def createFile(file : FileSchema):
    files[file.id] = file
    return {"message" : "File Created", "file" : file}

@app.get('/files/{id}')
def getFile(id: int):
    if id not in files:
        raise HTTPException(status_code=404, detail="File not found") 
    return files[id]

@app.put('/files/{id}')
def updateFile(id: int, file: FileSchema):
    files[id] = file
    return {"message" : "File Updated"}

@app.delete('/files/{id}')
def deleteFile(id: int):
    files.pop(id, None)
    return {"message" : "File Deleted."}



