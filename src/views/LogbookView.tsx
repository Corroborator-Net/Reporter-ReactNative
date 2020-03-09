import React from "react";
import {FlatList, Image, RefreshControl, SafeAreaView, StyleSheet, View} from "react-native";
import {ImageDatabase, LogbookDatabase} from "../interfaces/Storage";
import {Log, LogbookStateKeeper, LogMetadata} from "../interfaces/Data";
import {ListItem, Text} from "react-native-elements";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type State={
    logs:Log[]
    photos:Map<string, string>
    refreshing:boolean
}

type Props={
    logSource:LogbookDatabase;
    logbookStateKeeper:LogbookStateKeeper;
    imageSource:ImageDatabase;
    navigation:any;
}

export default class LogbookView extends React.PureComponent<Props, State> {

    // TODO AUDTIOR: The user should input this


    static LogsPerPage = 20;
    static ShouldUpdateLogbookView = false;
    previousLogLength = 0;
    previousLogbook = "";

    FlatList:any=null;
    state={
        logs:new Array<Log>(),
        photos:new Map<string, string>(),
        refreshing:false
    };


    componentDidMount(): void {
        this.FlatList = React.createRef();
        this.getLogs();
        this.props.navigation.addListener('focus', this.onScreenFocus)
    }


    // TODO: maybe add a callback to the logbook state keeper interface?
    logbookChanged() : boolean{
        return this.previousLogbook != this.props.logbookStateKeeper.CurrentLogbook
    }


    onScreenFocus = () => {
        if (this.previousLogLength < this.state.logs.length ||
            (this.logbookChanged())
        ){
            console.log("refreshing!");
            this.getLogs();
        }
        else if(LogbookView.ShouldUpdateLogbookView){
            this.getLogs();
            LogbookView.ShouldUpdateLogbookView = false;
        }
        this.previousLogbook = this.props.logbookStateKeeper.CurrentLogbook;
    };


    // TODO: implement pages or infinite scroll
    async getLogs(){
        const currentLogbook=this.props.logbookStateKeeper.CurrentLogbook;
        console.log("loading logs for logbook: ", currentLogbook);
        // get all of our reporters' logs - this will either be local storage or blockchain storage
        let newMap = new Map<string, string>();
        let logs = await this.props.logSource.getRecordsFor(currentLogbook);
        const photos = await this.props.imageSource.getImages(logs.slice(0,LogbookView.LogsPerPage));
        photos.map((photo:string,i:number) => {
            newMap.set(logs[i].dataMultiHash, photo);
        });
        this.setState({
            logs:logs,
            photos:newMap,
        });
        this.previousLogLength = logs.length;
    }


    render() {
        return (
            <SafeAreaView style={styles.container}>
                <FlatList
                        removeClippedSubviews={true}
                        ref={ (ref) => this.FlatList = ref }
                        initialNumToRender={8}
                        maxToRenderPerBatch={2}
                        data={this.state.logs}
                        renderItem={({item}) =>
                            <LogRowCell
                                src={ `data:image/jpeg;base64,${this.state.photos.get(item.dataMultiHash)}`}
                                item={item}
                            />
                        }
                        keyExtractor={item => item.dataMultiHash}
                        refreshControl={
                            <RefreshControl
                                refreshing={this.state.refreshing}
                                onRefresh={() => this.getLogs()}/>
                        }
                />
            </SafeAreaView>
        );
    }
}


type CellProps = {
    src: string;
    item:Log;
}

type CellState = {
    expanded:boolean
    metaList:Array<Element>
}

class LogRowCell extends React.Component<CellProps,CellState> {

    state = {
        expanded:false,
        metaList:this.getMetadata()
    };

    // TODO: if the cell doesn't have a transaction hash on creation, it should check for an updated one
    getMetadata():Array<Element>{
        let metaList = new Array<Element>();
        const obj = JSON.parse(this.props.item.signedMetadataJson)["0"];
        // add extra bits from the log
        obj["Hash"]=this.props.item.dataMultiHash;
        obj["Transaction Hash"]=this.props.item.transactionHash;

        Object.keys(obj).
        forEach(function eachKey(key)
        {
            metaList.push(<Text key={key}> <Text style={{fontWeight:"bold"}}>{key}</Text>: {obj[key]}</Text>);
        });
        return metaList;
    }

    render(){
        return (
            <ListItem
                style={{
                    backgroundColor: this.getColorForLog(this.props.item),
                    padding: 5,
                    marginVertical: 8,
                    marginHorizontal: 16,
                    flexDirection: 'column'
                }}
                onPress={(event => {this.setState({expanded: !this.state.expanded})})}
                // TODO: must decrypt here
                title={JSON.parse(this.props.item.signedMetadataJson)["0"][LogMetadata.DateTag]}
                leftIcon={
                    <Image
                        source={{uri: this.props.src}}
                        resizeMethod={"resize"}
                        style={{
                            width: 50,
                            height: 50,
                        }}
                    />
                }
                subtitle={
                    <View>
                        {this.state.expanded ?
                            <>
                                {this.state.metaList}
                            </>
                            :
                            <></>
                        }
                    </View>
                }
                chevron={this.state.expanded?
                    <Icon name={"chevron-up"} size={20} color={"grey"}/>
                    :
                    <Icon name={"chevron-down"} size={20} color={"grey"}/>
                }
                />
        );
    }

    // Hash status:
    // green: the log has a transaction hash, its data is on chain
    // yellow: the metadata has multiple signatures
    // orange: the log exists, has been saved

    // Data status:
    // solo icon: the data is local only
    // network icon: the data is backed up

    getColorForLog(log:Log):string{
        if (log.transactionHash.length<=1){
            console.log("log has no transaction hash, checking for other signatures from corroborators");
            const trueLog = Object.setPrototypeOf(log, Log.prototype);
            const reporterToMetadataMap = trueLog.getTimestampsMappedToReporterKeys();
            if (reporterToMetadataMap.size<=1){
                return 'orange';
            }
            else{
                // we have multiple signed metadata records
                return 'yellow';
            }
        }

        return 'lightgreen';
    }
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: 50,
    },

    title: {
        fontSize: 13,
        padding:10,
        flex:1,
        flexWrap: 'wrap',
        alignSelf: "center",

    },

});
