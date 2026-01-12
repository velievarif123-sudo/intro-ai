from flask_sqlalchemy import SQLAlchemy
import openai
import dotenv
import logging

# Настройка логгирования
logging.basicConfig(level=logging.ERROR, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Загружаем переменные окружения из файла .env
try:
    env = dotenv.dotenv_values(".env")
    YA_API_KEY = env["YA_API_KEY"]
    YA_FOLDER_ID = env["YA_FOLDER_ID"]
except FileNotFoundError:
    raise FileNotFoundError("Файл .env не найден. Убедитесь, что он существует в корневой директории проекта.")
except KeyError as e:
    raise KeyError(f"Переменная окружения {str(e)} не найдена в файле .env. Проверьте его содержимое.")


# Инициализируем SQLAlchemy для работы с базой данных через Flask
db = SQLAlchemy()


class ChatHistory(db.Model):
    """
    Модель SQLAlchemy для хранения истории общения пользователя с LLM.

    Атрибуты:
        id (int): Уникальный идентификатор записи.
        user_message (str): Сообщение пользователя.
        llm_reply (str): Ответ языковой модели.
        timestamp (datetime): Время создания записи.
    """
    id = db.Column(db.Integer, primary_key=True)  # Уникальный идентификатор
    user_message = db.Column(db.Text, nullable=False)  # Текст сообщения пользователя
    llm_reply = db.Column(db.Text, nullable=False)  # Ответ модели
    timestamp = db.Column(db.DateTime, server_default=db.func.now())  # Временная метка создания записи


class LLMService:
    """
    Класс для взаимодействия с внешней языковой моделью (например, YandexGPT).

    Атрибуты:
        sys_prompt (str): Системный промпт для LLM.
        client: Клиент OpenAI для обращения к API Yandex.
        model (str): Идентификатор используемой LLM модели.
    """
    def __init__(self, prompt_file):
        """
        Инициализация сервиса LLM.

        Аргументы:
            prompt_file (str): Путь к файлу с системным промптом для LLM.
        """
        # Читаем системный промпт из файла и сохраняем в атрибут sys_prompt
        with open(prompt_file, encoding='utf-8') as f:
            self.sys_prompt = f.read()
                
        try:
            # Создаём клиента OpenAI с вашим API-ключом и базовым URL для Yandex LLM API
            self.client = openai.OpenAI(
                api_key=YA_API_KEY,
                base_url="https://llm.api.cloud.yandex.net/v1",
            )
            # Формируем путь к модели с использованием идентификатора каталога из .env
            self.model = f"gpt://b1glh35hc2j5l5ado3fi/yandexgpt-lite"

        except Exception as e:
            logger.error(f"Ошибка при авторизации модели. Проверьте настройки аккаунта и область действия ключа API. {str(e)}")

    def chat(self, message):
        """
        Отправляет сообщение к языковой модели и возвращает её ответ.

        Аргументы:
            message (str): Сообщение пользователя.

        Возвращает:
            str: Ответ языковой модели или сообщение об ошибке.
        """
        try:
            # Выполняем запрос к API языковой модели
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.sys_prompt},
                    {"role": "user", "content": message},
                ],
                temperature=1.0,      # Параметр креативности
                max_tokens=1024,      # Максимальная длина ответа
            )

            # Возвращаем текст ответа модели
            return response.choices[0].message.content

        except Exception as e:
            # В случае ошибки возвращаем её описание
            logger.error(f"Произошла ошибка: {str(e)}")
            return f"Произошла ошибка: {str(e)}"


llm_1 = LLMService('prompts/prompt_1.txt')


def chat_with_llm(user_message):
    """
    Чат с использованием сервиса LLM.

    Аргументы:
        user_message (str): Сообщение пользователя.

    Возвращает:
        str: Ответ LLM.
    """
    response = llm_1.chat(user_message)
    return response
