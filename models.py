from pydantic import BaseModel, Field, field_validator
from typing import Literal, Union, List, Dict, Optional
from pydantic import model_validator



class Question(BaseModel):
    qid: Optional[int] = Field(None, description="ID autogenerado")
    question: str = Field(description="Texto de la pregunta")
    type: Literal["multiple_choice", "match"] = "multiple_choice"
    options: Optional[List[str]] = None  # Solo si type == multiple_choice
    answer: Union[List[str], Dict[str, str]]
    match_items: Optional[List[str]] = None  # Solo si type == match
    match_targets: Optional[List[str]] = None  # Solo si type == match
    image_base64: Optional[str] = None
    explanation: Optional[str] = None

    @model_validator(mode="after")
    def validar_pregunta(self):
        if self.type == "multiple_choice":
            if not isinstance(self.answer, list):
                raise ValueError("La respuesta debe ser una lista en preguntas de opción múltiple")
            if not self.options:
                raise ValueError("Faltan opciones en pregunta de opción múltiple")
            if not all(ans in self.options for ans in self.answer):
                raise ValueError("Todas las respuestas deben estar dentro de las opciones")
        elif self.type == "match":
            if not isinstance(self.answer, dict):
                raise ValueError("La respuesta debe ser un diccionario en preguntas de emparejamiento")
            if not self.match_items or not self.match_targets:
                raise ValueError("Faltan 'match_items' o 'match_targets' en pregunta tipo match")
            if set(self.answer.keys()) != set(self.match_items):
                raise ValueError("Las claves del diccionario deben coincidir con los 'match_items'")
            if not all(val in self.match_targets for val in self.answer.values()):
                raise ValueError("Todos los valores deben estar dentro de 'match_targets'")
        return self

class RespuestaUsuario(BaseModel):
    qid: int
    answers: Union[List[str], Dict[str, str]]  # Soporta ambos tipos
    explanation: Optional[str] = None