//! Qiita API v2 の呼び出し。レンダラーから届く値はここで検証してから使う。
//!
//! - 記事ヘッダに id が無ければ POST /api/v2/items（201）、あれば PATCH /api/v2/items/:item_id（200）
//! - トークン確認は GET /api/v2/authenticated_user（200）
//! - 結果はレンダラーの PostResult / VerifyTokenResult（shared/api.ts）と同じ形のJSONで返す

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

const QIITA_API: &str = "https://qiita.com/api/v2";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct QiitaTag {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub versions: Option<Vec<String>>,
}

/// 投稿・更新APIに送る本文（shared/schema.ts の QiitaItemBodySchema と同じ項目）
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ItemBody {
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<QiitaTag>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coediting: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tweet: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_url_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization_url_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slide: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub posting_campaign_uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agreed_posting_campaign_term: Option<bool>,
}

impl ItemBody {
    pub fn validate(&self) -> Result<(), String> {
        if let Some(uuid) = &self.posting_campaign_uuid {
            if uuid.len() != 20
                || !uuid
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
            {
                return Err("投稿キャンペーンのUUIDの形式が正しくありません".into());
            }
            if self.agreed_posting_campaign_term != Some(true) {
                return Err("posting_campaign_uuid を指定する場合は agreed_posting_campaign_term: true が必要です".into());
            }
        }
        Ok(())
    }
}

/// 記事idはURLのパスに入るため英数字のみ許可する
pub fn validate_item_id(id: &str) -> Result<(), String> {
    if !id.is_empty() && id.bytes().all(|b| b.is_ascii_alphanumeric()) {
        Ok(())
    } else {
        Err("記事のidの形式が正しくありません".into())
    }
}

pub fn validate_token(token: &str) -> Result<(), String> {
    if token.is_empty() {
        Err("トークンがありません".into())
    } else {
        Ok(())
    }
}

fn api_url(segments: &[&str]) -> Result<reqwest::Url, String> {
    let base = crate::e2e::qiita_api().unwrap_or_else(|| QIITA_API.to_string());
    let mut url = reqwest::Url::parse(&base).map_err(|e| e.to_string())?;
    // パスの各要素はエンコードして追加する
    url.path_segments_mut()
        .map_err(|_| "QiitaのURLが不正です".to_string())?
        .pop_if_empty()
        .extend(segments);
    Ok(url)
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(concat!("TsumiQiita/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())
}

/// エラーレスポンス（{ message, type }）を結果に含める
async fn api_error(res: reqwest::Response) -> Value {
    let status = res.status().as_u16();
    let error: Option<Value> = res.json().await.ok();
    let text = |key: &str| {
        error
            .as_ref()
            .and_then(|e| e.get(key))
            .and_then(Value::as_str)
            .map(str::to_string)
    };
    let mut result = json!({ "ok": false, "status": status });
    if let (Some(message), Some(kind)) = (text("message"), text("type")) {
        result["message"] = json!(message);
        result["type"] = json!(kind);
    }
    result
}

/// 新規投稿（idなし）または更新（idあり）
pub async fn post_item(
    token: &str,
    mut body: ItemBody,
    item_id: Option<&str>,
) -> Result<Value, String> {
    validate_token(token)?;
    body.validate()?;
    let (request, success) = match item_id {
        Some(id) => {
            validate_item_id(id)?;
            // tweet はPATCHの引数に無いため送らない
            body.tweet = None;
            (client()?.patch(api_url(&["items", id])?), 200)
        }
        None => (client()?.post(api_url(&["items"])?), 201),
    };
    let res = match request.bearer_auth(token).json(&body).send().await {
        Ok(res) => res,
        Err(_) => return Ok(json!({ "networkError": true })),
    };
    let status = res.status().as_u16();
    if status != success {
        return Ok(api_error(res).await);
    }
    let item: Option<Value> = res.json().await.ok();
    let text = |key: &str| {
        item.as_ref()
            .and_then(|i| i.get(key))
            .and_then(Value::as_str)
            .map(str::to_string)
    };
    let mut result = json!({ "ok": true, "status": status });
    if let (Some(id), Some(url)) = (text("id"), text("url")) {
        result["id"] = json!(id);
        result["url"] = json!(url);
    }
    Ok(result)
}

/// トークンが有効か確認する
pub async fn verify_token(token: &str) -> Result<Value, String> {
    validate_token(token)?;
    let res = match client()?
        .get(api_url(&["authenticated_user"])?)
        .bearer_auth(token)
        .send()
        .await
    {
        Ok(res) => res,
        Err(_) => return Ok(json!({ "networkError": true })),
    };
    if res.status().as_u16() != 200 {
        return Ok(api_error(res).await);
    }
    let user: Option<Value> = res.json().await.ok();
    match user
        .as_ref()
        .and_then(|u| u.get("id"))
        .and_then(Value::as_str)
    {
        Some(id) => Ok(json!({ "ok": true, "userId": id })),
        None => Ok(json!({ "ok": false, "status": 200 })),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn body(json: Value) -> Result<ItemBody, serde_json::Error> {
        serde_json::from_value(json)
    }

    #[test]
    fn rejects_unknown_fields() {
        assert!(body(json!({ "body": "x", "unknown": 1 })).is_err());
        assert!(body(json!({ "body": "x", "tags": [{ "name": "a", "extra": 1 }] })).is_err());
    }

    #[test]
    fn validates_posting_campaign() {
        let ok = body(json!({ "body": "x", "posting_campaign_uuid": "0123456789abcdef0123", "agreed_posting_campaign_term": true })).unwrap();
        assert!(ok.validate().is_ok());
        let not_agreed =
            body(json!({ "body": "x", "posting_campaign_uuid": "0123456789abcdef0123" })).unwrap();
        assert!(not_agreed.validate().is_err());
        let bad_uuid = body(json!({ "body": "x", "posting_campaign_uuid": "XYZ", "agreed_posting_campaign_term": true })).unwrap();
        assert!(bad_uuid.validate().is_err());
    }

    #[test]
    fn validates_item_id() {
        assert!(validate_item_id("abc123DEF").is_ok());
        assert!(validate_item_id("../../authenticated_user").is_err());
        assert!(validate_item_id("a/b").is_err());
        assert!(validate_item_id("").is_err());
    }

    #[test]
    fn builds_encoded_api_urls() {
        assert_eq!(
            api_url(&["items", "abc123"]).unwrap().as_str(),
            "https://qiita.com/api/v2/items/abc123"
        );
        assert_eq!(
            api_url(&["authenticated_user"]).unwrap().as_str(),
            "https://qiita.com/api/v2/authenticated_user"
        );
    }

    #[test]
    fn omits_unset_fields_when_serializing() {
        let b = body(json!({ "body": "x", "title": "t" })).unwrap();
        assert_eq!(
            serde_json::to_value(&b).unwrap(),
            json!({ "body": "x", "title": "t" })
        );
    }

    #[test]
    fn rejects_empty_token() {
        assert!(validate_token("").is_err());
        assert!(validate_token("t").is_ok());
    }
}
