// index.js
const https = require('https');
const url = require('url');

const serviceActionBlock = (message) => {
    const block = {
        type: "section",
        fields: [
            {
                type: "mrkdwn",
                text: `*Event Type:*\n${message['detail-type']}`
            },
            {
                type: "mrkdwn",
                text: `*Level:*\n${message.detail?.eventType}`
            },
            {
                type: "mrkdwn",
                text: `*Status:*\n${message.detail?.eventName}`
            }
        ]
    }

    return block;
}

const deploymentStateChangeBlock = (message) => {
    const block = {
        type: "section",
        fields: [
            {
                type: "mrkdwn",
                text: `*Event Type:*\n${message['detail-type']}`
            },
            {
                type: "mrkdwn",
                text: `*Level:*\n${message.detail?.eventType}`
            },
            {
                type: "mrkdwn",
                text: `*Status:*\n${message.detail?.eventName}`
            },
            {
                type: "mrkdwn",
                text: `*Deployment:*\n${message.detail?.deploymentId}`
            },
            {
                type: "mrkdwn",
                text: `*Reason:*\n${message.detail?.reason}`
            }
        ]
    }

    return block;
}

const taskStateChangeBlock = (message) => {
    const cluster = message.detail?.clusterArn?.split('/').pop() ?? 'UnknownCluster';
    const block = {
        type: "section",
        fields: [
            {
                type: "mrkdwn",
                text: `*Event Type:*\n${message['detail-type']}`
            },
            {
                type: "mrkdwn",
                text: `*Cluster:*\n${cluster}`
            },
            {
                type: "mrkdwn",
                text: `*Service:*\n${cluster}/${message.detail?.group?.split(':').pop()}`
            },
            {
                type: "mrkdwn",
                text: `*Task:*\n${message.detail?.taskArn?.split('/').pop()}`
            },
            {
                type: "mrkdwn",
                text: `*Desired Status:*\n${message.detail?.desiredStatus}`
            },
            {
                type: "mrkdwn",
                text: `*Last Status:*\n${message.detail?.lastStatus}`
            }
        ]
    };

    if (message.detail?.stoppedReason) {
        block.fields.push({
            type: "mrkdwn",
            text: `*Reason:*\n${message.detail?.stoppedReason}`
        });
    }

    return block;
};

exports.handler = async (event) => {
    const message = JSON.parse(event.Records[0].Sns.Message);

    let slackMessage = {
        blocks: []
    };

    const eventType = message['detail-type'];
    switch (eventType) {
        case 'ECS Task State Change':
            slackMessage.blocks.push(taskStateChangeBlock(message));
            break;
        case 'ECS Deployment State Change':
            slackMessage.blocks.push(deploymentStateChangeBlock(message));
            break;
        case 'ECS Service Action':
            // slackMessage.blocks.push(serviceActionBlock(message));
            break;
        default:
            slackMessage.blocks.push({
                type: "rich_text",
                elements: [
                    {
                        type: "rich_text_preformatted",
                        elements: [{
                            type: "text",
                            text: `${JSON.stringify(message, null, 2)}`
                        }]
                    }
                ]
            });
            break;
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const options = url.parse(webhookUrl);
    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/json'
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: body }));
        });

        req.on('error', (e) => reject(e));
        req.write(JSON.stringify(slackMessage));
        req.end();
    });
};