import { MongoClient, ObjectId } from "mongodb";

type EnvType = 'production' | 'test' | 'development';

interface Credential {
    version: string;
    value: string;
}

export interface SecretVersionResponse {
    status: boolean;
    projectName: string;
    serviceName: string;
    message: string;
    secret?: Secret | null;
    credential?: Credential;
}

interface AddSecretVersionParams {
    dbClient: MongoClient;
    projectName: string;
    serviceName: string;
    secretName: string;
    version: string;
    value: string;
}

interface Secret {
    _id: ObjectId;
    secretName: string;
    envName: string;
    envType: EnvType;
    credential: Credential[];
    updatedAt: Date;
    createdAt: Date;
    lastAccessAt: Date;
}

// Adds a version to a secret if it doesn't already exist.
export const addSecretVersion = async (params: AddSecretVersionParams): Promise<SecretVersionResponse> => {
    const { dbClient, projectName, serviceName, secretName, version, value } = params;
    try {
        let secret = await dbClient.db(projectName).collection(serviceName).findOne<Secret>({ secretName });

        // Secret not found or version already exists.
        if (!secret || secret.credential.some(cred => cred.version === version)) {
            return {
                status: !secret,
                message: !secret ? `Secret '${secretName}' not found.` : `Version '${version}' already exists.`,
                projectName,
                serviceName,
                secret,
            };
        }

        // Add new version and update secret.
        await dbClient.db(projectName).collection(serviceName).updateOne({ secretName }, {
            $push: { credential: { version, value } },
            $currentDate: { lastAccessAt: true, updatedAt: true }
        } as any);

        secret = await dbClient.db(projectName).collection(serviceName).findOne<Secret>({ secretName });
        return {
            status: true,
            message: `Version '${version}' added.`,
            projectName,
            serviceName,
            secret,
            credential: { version, value: value }
        };
    } catch (error: any) {
        console.error("Error adding/updating secret version:", error);
        return { status: false, message: error.message, projectName, serviceName };
    }
};

// Updates an existing version of a secret.
export const updateSecretVersion = async (params: AddSecretVersionParams): Promise<SecretVersionResponse> => {
    const { dbClient, projectName, serviceName, secretName, version, value } = params;
    try {
        const result = await dbClient.db(projectName).collection(serviceName).updateOne(
            { secretName, "credential.version": version },
            { $set: { "credential.$.value": value } }
        );

        if (result.modifiedCount === 0) {
            return { status: false, message: "No secret matched or no changes needed.", projectName, serviceName };
        }

        const secret = await dbClient.db(projectName).collection(serviceName).findOne<Secret>({ secretName });
        return {
            status: true,
            message: `Version '${version}' updated.`,
            projectName,
            serviceName,
            secret,
            credential: { version, value: value }
        };
    } catch (error: any) {
        console.error("Error updating secret version:", error);
        return { status: false, message: error.message, projectName, serviceName };
    }
};

export const findLatestSecretVersion = async (
    dbClient: MongoClient,
    projectName: string,
    serviceName: string,
    secretName: string
): Promise<{ status: boolean, message: string, credential?: Credential }> => {
    try {
        const secret = await dbClient.db(projectName).collection(serviceName).findOne<Secret>({ secretName });
        
        if (!secret || !secret.credential || secret.credential.length === 0) {
            return { status: false, message: `No credentials found for secret '${secretName}'.` };
        }
        
        // Sort credentials by version in descending order
        const sortedCredentials = secret.credential.sort((a, b) => {
            // Assuming semantic versioning, this will need to be adjusted if a different versioning scheme is used
            return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Return the latest version
        return {
            status: true,
            message: `Latest credential version retrieved successfully.`,
            credential: sortedCredentials[0] // The first credential after sorting will be the latest
        };
    } catch (error: any) {
        console.error("Error finding latest secret version:", error);
        return { status: false, message: error.message };
    }
};