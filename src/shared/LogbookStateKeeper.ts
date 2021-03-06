import {LogbookEntry} from "../interfaces/Data";
import {CorroborateLogsViewNameAndID, prettyPrint, UserPreferenceKeys} from "./Constants";
import {LogbookDatabase, UserPreferenceStorage} from "../interfaces/Storage";
import {LogbookAndSection} from "../interfaces/Data";
import {BlockchainInterface} from "../interfaces/BlockchainInterface";
import {Alert} from "react-native";
import {LogManager} from "./LogManager";



export default class LogbookStateKeeper {

    public LogsToCorroborate:LogbookAndSection[] = [];
    public CurrentSelectedLogs:LogbookEntry[]=[];

    private _CurrentLogbookID:string = "";

    constructor(public userPreferences:UserPreferenceStorage,
                public logbookStorage:LogbookDatabase,
                public blockchainInterface:BlockchainInterface) {
    }


    LogbookName(logbookID:string):string {
        // console.log("user prefs:",this.userPreferences);

        if (logbookID != "") {
            return this.userPreferences.GetCachedUserPreference(logbookID)[0];
        }
        return "Not Set"
    }

    set CurrentLogbookID(logbook){
        this._CurrentLogbookID = logbook;
        // this.userPreferences.SetNewPersistentUserPreference(UserPreferenceKeys.CurrentLogbook,[logbook]);
    }


    // to satisfy the interface - can't have static methods
    get CurrentLogbookID(): string {
        return this._CurrentLogbookID;
        // console.log("current logbook: ", this.CurrentUserSettings[UserPreferenceKeys.CurrentLogbook][0])
        // return this.userPreferences.GetCachedUserPreference(UserPreferenceKeys.CurrentLogbook)[0];
    }


    get AvailableLogbooks():string[] {
        return this.userPreferences.GetCachedUserPreference(UserPreferenceKeys.Logbooks);
    }

    async GetAllLogsAndSectionsForCurrentLogbook(): Promise<LogbookAndSection[]> {
        if (this._CurrentLogbookID == CorroborateLogsViewNameAndID){
            return this.LogsToCorroborate
        }
        let localLogs = await this.logbookStorage.getRecordsFor(this._CurrentLogbookID, null);


        try {
            // if any of the local logs and bchain logs share the current transaction hash, they're the same entry
            let uniqueLogsOnChain = localLogs.length>0 && LogManager.CurrentlyConnectedToNetwork
                ? await this.blockchainInterface.getRecordsFor(this._CurrentLogbookID, localLogs)
                : [];

            // prettyPrint("logs on chain", uniqueLogsOnChain)
            return [{
                title: this._CurrentLogbookID,
                logs:localLogs.concat(uniqueLogsOnChain)
            }];
        }
        catch (e) {
            Alert.alert(
                "Couldn't Get Corroborating Logs", e+"", [{text: 'OK'},],
                { cancelable: false }
            );
            return [{
                title: this._CurrentLogbookID,
                logs:localLogs
            }];
        }


        // prettyPrint("uniquelogs:", uniqueLogsOnChain);



    }

}