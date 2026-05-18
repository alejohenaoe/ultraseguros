variable "aws_region" {
  description = "Región de AWS donde se desplegará el proyecto"
  default     = "us-east-2"
}

variable "project_name" {
  description = "Nombre del proyecto, usado como prefijo en los recursos"
  default     = "ultraseguros"
}
