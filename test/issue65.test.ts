import {AttributeValue, DeleteItemCommand, DynamoDBClient, GetItemCommand} from '@aws-sdk/client-dynamodb';
import {mockClient} from 'aws-sdk-client-mock';
import faker from 'faker';
import {ulid} from 'ulid';

const ddbMock = mockClient(DynamoDBClient);

function getDdbSceneOutput(accountId: string, sceneId: string): { [key: string]: AttributeValue } {
    return {
        accountId: {S: accountId},
        apiKey: {S: faker.internet.password()},
        createdAt: {S: faker.date.recent().toISOString()},
        dataPlaneAccountId: {S: faker.internet.password()},
        eventBus: {S: faker.internet.password()},
        id: {S: sceneId},
        managementRole: {S: faker.internet.password()},
        realtimeEventWsUrl: {S: faker.internet.password()},
        runtimeRole: {S: faker.internet.password()},
        status: {S: 'RUNNING'},
    };
}

function getDdbNodeOutput(sceneId: string, nodeId: string): { [key: string]: AttributeValue } {
    return {
        awsIdentifier: {S: faker.internet.password()},
        awsOperationStatus: {S: faker.internet.password()},
        awsState: {S: '{}'},
        awsTypeName: {S: 'AWS::Lambda::Function'},
        createdAt: {S: faker.date.recent().toISOString()},
        id: {S: nodeId},
        name: {S: faker.name.jobDescriptor()},
        sceneId: {S: sceneId},
        state: {S: 'RUNNING'},
    };
}

const handler = async (event: { accountId: string, nodeId: string, sceneId: string, tableName: string }) => {
    const {accountId, nodeId, sceneId, tableName} = event;

    const ddbClient = new DynamoDBClient({});

    await ddbClient.send(new GetItemCommand({
        TableName: tableName,
        Key: {
            PK: {S: `ACCOUNT#${accountId}`},
            SK: {S: `SCENE#${sceneId}`},
        }
    }));

    await ddbClient.send(new GetItemCommand({
        TableName: tableName,
        Key: {
            PK: {S: `ACCOUNT#${accountId}|SCENE#${sceneId}`},
            SK: {S: `NODE#${nodeId}`},
        }
    }));

    await ddbClient.send(new DeleteItemCommand({
        TableName: tableName,
        Key: {
            PK: {S: `ACCOUNT#${accountId}|SCENE#${sceneId}`},
            SK: {S: `NODE#${nodeId}`},
        }
    }));
};

describe('tests nodeDelete', () => {
    beforeEach(() => {
        ddbMock.reset();
    });

    test('returns a node not found error when dynamo fails to return a node', async () => {
        const accountId = ulid();
        const sceneId = ulid();
        const nodeId = ulid();
        const tableName = 'fakeTableName';
        const event = {accountId, nodeId, sceneId, tableName};

        ddbMock
            .on(GetItemCommand, {
                Key: {
                    PK: {S: `ACCOUNT#${accountId}`},
                    SK: {S: `SCENE#${sceneId}`},
                },
                TableName: tableName,
            })
            .rejects(new Error('fake ddb scene get error'))
            .on(GetItemCommand, {
                Key: {
                    PK: {S: `ACCOUNT#${accountId}|SCENE#${sceneId}`},
                    SK: {S: `NODE#${nodeId}`},
                },
                TableName: tableName,
            })
            .resolves({});

        await expect(handler(event)).rejects.toThrow('fake ddb scene get error');
    });

    test('returns a generic error when dynamodb fails to delete', async () => {
        const accountId = ulid();
        const sceneId = ulid();
        const nodeId = ulid();
        const tableName = 'fakeTableName';
        const event = {accountId, nodeId, sceneId, tableName};

        ddbMock
            .on(GetItemCommand, {
                Key: {
                    PK: {S: `ACCOUNT#${accountId}`},
                    SK: {S: `SCENE#${sceneId}`},
                },
                TableName: tableName,
            })
            .resolves({Item: getDdbSceneOutput(nodeId, sceneId)})
            .on(GetItemCommand, {
                Key: {
                    PK: {S: `ACCOUNT#${accountId}|SCENE#${sceneId}`},
                    SK: {S: `NODE#${nodeId}`},
                },
                TableName: tableName,
            })
            .resolves({Item: getDdbNodeOutput(nodeId, sceneId)})
            .on(DeleteItemCommand, {
                Key: {
                    PK: {S: `ACCOUNT#${accountId}|SCENE#${sceneId}`},
                    SK: {S: `NODE#${nodeId}`},
                },
                TableName: tableName,
            })
            .rejects(new Error('fake ddb node delete error'));

        await expect(handler(event)).rejects.toThrow('fake ddb node delete error');
    });
});
