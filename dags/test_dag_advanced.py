from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator
import time

default_args = {
    'owner': 'test_user',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=2),
}

def task_with_sleep(seconds=5):
    """Task that sleeps for testing running state"""
    print(f"Starting task, will sleep for {seconds} seconds")
    time.sleep(seconds)
    print("Task completed!")
    return f"Slept for {seconds} seconds"

def task_with_params(**context):
    """Task that uses parameters"""
    print(f"Execution date: {context['execution_date']}")
    print(f"DAG run config: {context.get('dag_run').conf if context.get('dag_run') else 'No config'}")
    return "Parameters processed"

with DAG(
    'test_dag_advanced',
    default_args=default_args,
    description='An advanced test DAG with multiple tasks',
    schedule_interval='@daily',
    catchup=False,
    tags=['test', 'advanced', 'demo'],
) as dag:

    start = BashOperator(
        task_id='start_task',
        bash_command='echo "Starting DAG execution"',
    )

    process_1 = PythonOperator(
        task_id='process_task_1',
        python_callable=task_with_sleep,
        op_kwargs={'seconds': 3},
    )

    process_2 = PythonOperator(
        task_id='process_task_2',
        python_callable=task_with_sleep,
        op_kwargs={'seconds': 5},
    )

    process_params = PythonOperator(
        task_id='process_params',
        python_callable=task_with_params,
        provide_context=True,
    )

    end = BashOperator(
        task_id='end_task',
        bash_command='echo "DAG execution completed"',
    )

    start >> [process_1, process_2] >> process_params >> end
