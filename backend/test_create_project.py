import requests
import json

url = "http://localhost:8001/api/projects/"
data = {
    "title": "测试项目",
    "jd_text": "这是一个测试职位描述"
}

print("发送请求...")
print(f"URL: {url}")
print(f"Data: {json.dumps(data, ensure_ascii=False)}")

try:
    response = requests.post(url, json=data)
    print(f"\n状态码: {response.status_code}")
    print(f"响应头: {response.headers}")
    print(f"响应内容: {response.text}")

    if response.status_code == 200:
        print("\n成功创建项目!")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print(f"\n创建失败: {response.text}")
except Exception as e:
    print(f"\n请求异常: {e}")
