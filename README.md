tf_aws_ecs_slack_notifications
==============================
This is a terraform module which applies an EventBridge Rule to get notified an ECS Events in Slack.

# Requirements
You need a [Slack webhook](https://api.slack.com/messaging/webhooks) URL to pass as parameter for this module

# Example Implementation
```hcl
...

module "ecs_notifications" {
    source            = "git::https://github.com/katunch/tf_aws_ecs_slack_notifications?ref=v1.0.0"
    slack_webhook_url = "https://webhooks.slack.com/...."
}
...
```