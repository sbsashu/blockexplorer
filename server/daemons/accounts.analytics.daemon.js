/*
    Accounts analytics daemon
*/
const { rix, STATS_ACCOUNT_DB, log, config, asyncjs } = require('./header')('accounts_analytics');
const { asyncWrapper, asyncForEach } = require('../utils/main.utils');
const wrapper = new asyncWrapper(log);

const toInt = config.toInt;
const coin  = config.coin;

let usersMaxLimit = 100000;
let usersMaxSkip = 0;
let counter = 0;

async function getAccountsAnalytics (){
	let accounts = await wrapper.toStrong(STATS_ACCOUNT_DB.find({}, "account_name").skip(usersMaxSkip).limit(usersMaxLimit));
	if (!accounts || !accounts.length){
		log.info('No Accounts in DB!');
		process.exit();
	}

	asyncjs.eachLimit(accounts, config.limitAsync, (elem, cb) => {
			rix.getAccount({ account_name: elem.account_name })
				.then(account => {
					findBalanceAndUpdate(account, () => {
						console.log(`==== Accounts updated - ${elem.account_name}, cursor `, counter++);
						cb();
					});
				})
				.catch(err => {
					console.error('====== getAccountsAnalytics getAccount elem error - ', err);
					cb();
				});
			}, (err) => {
				if (err){
					log.error(err);
				}
				log.info('===== end analytics function, cursor', usersMaxSkip);
				usersMaxSkip += accounts.length;
				getAccountsAnalytics();
	});
};

function findBalanceAndUpdate(account, callback) {
	  if (!account){
		  return callback();
      }
      let accInfo = {
		  staked: 0,
		  unstaked: 0,
		  balance_rix: 0,
		  balance: []
	  };
      if (account && account.voter_info && account.voter_info.staked){
			accInfo.staked = account.voter_info.staked / toInt;
      }

 	  rix.getCurrencyBalance({
      			code: 'rixio.token',
      			account: account.account_name
			}).then(balance => {
	   	 		accInfo.balance = Array.isArray(balance) ? balance : [];
	   	 		accInfo.balance.forEach((elem) => {
	   	 			if (elem.indexOf(coin) !== -1){
	   	 				accInfo.unstaked = !isNaN(Number(elem.split(' ')[0])) ? Number(elem.split(' ')[0]) : 0;
	   	 			}
	   	 		});
	   	 		accInfo.balance_rix = accInfo.unstaked + accInfo.staked;
	   	 		let saveObject = { staked: accInfo.staked,
	   	 						   unstaked: accInfo.unstaked,
	   	 						   balance_rix: accInfo.balance_rix,
	   	 						   balance: accInfo.balance,
	   	 						   ram_usage: account.ram_usage,
	   	 						   ram_quota: account.ram_quota,
	   	 						   created: new Date(account.created) 
	   	 						  };
	   	 		STATS_ACCOUNT_DB.findOneAndUpdate({ account_name: account.account_name }, saveObject, {multi: true})
	   	 				     	.exec((err) => {
	   	 				     		if (err){
	   	 				     			log.error(err);
	   	 				     		}
	   	 				     		callback();
	   	 				     	});
	   	 	}).catch(err => {
	   	 		log.error(err);
	   	 		callback();
	   	 	});
}


getAccountsAnalytics();


